//! Self-updater compatible with the existing release pipeline: it reads the
//! same `latest.json` the Tauri updater used, verifies the minisign signature
//! against the same public key, and installs the platform bundle.
//!
//! - macOS: unpacks `Handy.app.tar.gz` and swaps it in for the running bundle.
//! - Windows: runs the NSIS installer in passive mode, which relaunches Handy.
//! - Linux: replaces the running AppImage.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, bail, Context, Result};
use futures_util::StreamExt;
use serde::Deserialize;

const ENDPOINT: &str = "https://github.com/cjpais/Handy/releases/latest/download/latest.json";
const PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEJBQjcyMDk1MjA2NjAxRjkKUldUNUFXWWdsU0MzdXRRZi8zYzhqV2FaNUVDbDd2Rk5VM1IvWWowVXdmRFNKQ1BrMXF5RFFsLy8K";

#[derive(Debug, Clone, Deserialize)]
struct PlatformRelease {
    signature: String,
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct Manifest {
    version: String,
    #[serde(default)]
    platforms: std::collections::HashMap<String, PlatformRelease>,
}

/// An available update for this platform.
#[derive(Debug, Clone)]
pub struct Update {
    pub version: String,
    /// The full manifest, used to find the portable installer.
    pub raw_json: serde_json::Value,
    url: String,
    signature: String,
}

fn os_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

pub fn arch_name() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86") {
        "i686"
    } else if cfg!(target_arch = "arm") {
        "armv7"
    } else {
        "x86_64"
    }
}

/// Keys to look up in `platforms`, most specific first.
fn platform_keys() -> Vec<String> {
    let base = format!("{}-{}", os_name(), arch_name());
    let installer = if cfg!(target_os = "macos") {
        "app"
    } else if cfg!(target_os = "windows") {
        "nsis"
    } else {
        "appimage"
    };
    vec![format!("{base}-{installer}"), base]
}

fn client() -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .user_agent(format!("Handy/{}", env!("CARGO_PKG_VERSION")))
        .build()?)
}

/// Fetches the manifest and returns the update when it is newer than this
/// build.
pub async fn check() -> Result<Option<Update>> {
    let raw_json: serde_json::Value = client()?
        .get(ENDPOINT)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let manifest: Manifest = serde_json::from_value(raw_json.clone())?;

    let remote = semver::Version::parse(manifest.version.trim_start_matches('v'))
        .with_context(|| format!("invalid release version '{}'", manifest.version))?;
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))?;
    if remote <= current {
        return Ok(None);
    }

    let release = platform_keys()
        .iter()
        .find_map(|key| manifest.platforms.get(key))
        .cloned()
        .ok_or_else(|| {
            anyhow!(
                "release {} has no build for this platform",
                manifest.version
            )
        })?;

    Ok(Some(Update {
        version: manifest.version,
        raw_json,
        url: release.url,
        signature: release.signature,
    }))
}

/// Downloads, verifies and installs `update`. `on_progress` receives
/// `(chunk_len, content_length)` per chunk, like the Tauri updater's
/// Started/Progress events.
pub async fn download_and_install(
    update: &Update,
    on_progress: impl Fn(u64, Option<u64>) + Send,
) -> Result<()> {
    log::info!("Downloading update {}", update.version);
    let response = client()?
        .get(&update.url)
        .send()
        .await?
        .error_for_status()?;
    let content_length = response.content_length();
    let mut bytes = Vec::with_capacity(content_length.unwrap_or(0) as usize);
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        on_progress(chunk.len() as u64, content_length);
        bytes.extend_from_slice(&chunk);
    }

    verify_signature(&bytes, &update.signature)?;
    let file_name = update
        .url
        .rsplit('/')
        .next()
        .unwrap_or("update")
        .to_string();
    crate::runtime::spawn_blocking(move || install(&bytes, &file_name)).await??;
    Ok(())
}

fn decode_base64_text(value: &str) -> Result<String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(value.trim())?;
    Ok(String::from_utf8(bytes)?)
}

fn verify_signature(data: &[u8], signature: &str) -> Result<()> {
    let public_key = minisign_verify::PublicKey::decode(&decode_base64_text(PUBLIC_KEY)?)
        .map_err(|e| anyhow!("invalid updater public key: {e}"))?;
    let signature = minisign_verify::Signature::decode(&decode_base64_text(signature)?)
        .map_err(|e| anyhow!("invalid update signature: {e}"))?;
    public_key
        .verify(data, &signature, true)
        .map_err(|e| anyhow!("update signature does not match: {e}"))
}

fn unpack_tar_gz(data: &[u8], dest: &Path) -> Result<()> {
    let decoder = flate2::read::GzDecoder::new(data);
    tar::Archive::new(decoder).unpack(dest)?;
    Ok(())
}

fn temp_dir(label: &str) -> Result<PathBuf> {
    let dir = std::env::temp_dir().join(format!("handy-update-{label}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

#[cfg(target_os = "macos")]
fn install(data: &[u8], _file_name: &str) -> Result<()> {
    let exe = std::env::current_exe()?;
    let bundle = exe
        .ancestors()
        .find(|p| p.extension().is_some_and(|ext| ext == "app"))
        .ok_or_else(|| anyhow!("Handy is not running from an .app bundle"))?
        .to_path_buf();

    let staging = temp_dir("extract")?;
    unpack_tar_gz(data, &staging)?;
    let new_bundle = std::fs::read_dir(&staging)?
        .flatten()
        .map(|entry| entry.path())
        .find(|p| p.extension().is_some_and(|ext| ext == "app"))
        .ok_or_else(|| anyhow!("update archive contains no .app bundle"))?;

    // Move the running bundle aside first so a failed move can be undone.
    let backup = temp_dir("backup")?.join("Handy.app");
    std::fs::rename(&bundle, &backup).context("moving the current app aside")?;
    if let Err(e) = move_dir(&new_bundle, &bundle) {
        let _ = std::fs::rename(&backup, &bundle);
        return Err(e.context("installing the new app"));
    }
    let _ = std::fs::remove_dir_all(backup.parent().unwrap_or(&backup));
    let _ = std::fs::remove_dir_all(&staging);
    Ok(())
}

/// `rename`, falling back to a recursive copy across volumes.
#[cfg(target_os = "macos")]
fn move_dir(from: &Path, to: &Path) -> Result<()> {
    if std::fs::rename(from, to).is_ok() {
        return Ok(());
    }
    let status = std::process::Command::new("/bin/cp")
        .arg("-R")
        .arg(from)
        .arg(to)
        .status()?;
    if !status.success() {
        bail!("cp exited with {status}");
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn install(data: &[u8], file_name: &str) -> Result<()> {
    let dir = temp_dir("installer")?;
    let installer = dir.join(if file_name.ends_with(".exe") {
        file_name.to_string()
    } else {
        "Handy-setup.exe".to_string()
    });
    std::fs::write(&installer, data)?;
    // Passive install that relaunches Handy, as the Tauri updater ran it.
    std::process::Command::new(&installer)
        .args(["/P", "/R"])
        .spawn()
        .context("starting the installer")?;
    std::process::exit(0);
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn install(data: &[u8], file_name: &str) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let target = std::env::var_os("APPIMAGE")
        .map(PathBuf::from)
        .ok_or_else(|| anyhow!("automatic updates need the AppImage build"))?;
    let image = if file_name.ends_with(".tar.gz") {
        let staging = temp_dir("extract")?;
        unpack_tar_gz(data, &staging)?;
        let path = std::fs::read_dir(&staging)?
            .flatten()
            .map(|entry| entry.path())
            .find(|p| p.extension().is_some_and(|ext| ext == "AppImage"))
            .ok_or_else(|| anyhow!("update archive contains no AppImage"))?;
        std::fs::read(path)?
    } else {
        data.to_vec()
    };
    let tmp = target.with_extension("update");
    std::fs::write(&tmp, image)?;
    std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o755))?;
    std::fs::rename(&tmp, &target)?;
    Ok(())
}

/// Download page for portable installs, which cannot update in place.
pub const PORTABLE_RELEASES_URL: &str = "https://github.com/cjpais/Handy/releases/latest";

/// The NSIS installer URL from the manifest for portable Windows installs,
/// or `None` to send the user to the releases page.
pub fn portable_installer_url(raw_json: &serde_json::Value) -> Option<String> {
    if !cfg!(target_os = "windows") {
        return None;
    }
    let arch = match arch_name() {
        "aarch64" => "aarch64",
        _ => "x86_64",
    };
    raw_json
        .get("platforms")?
        .get(format!("windows-{arch}-nsis"))?
        .get("url")?
        .as_str()
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_key_decodes() {
        let text = decode_base64_text(PUBLIC_KEY).unwrap();
        assert!(minisign_verify::PublicKey::decode(&text).is_ok());
    }

    #[test]
    fn rejects_tampered_data() {
        // Signature of a different file must not verify.
        let sig = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUNUFXWWdsU0MzdW5pRVNzUEk3ZTUzSm1sR1pyUzNsbGhxdjJMbDc3WEtCK0lDNFd2aFY0Zk1DWFoyaUJSN3VTM09aSy80cUpFK01KSnBPcEF5UlRKc3BkSTJmT0tDdFF3PQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwOTk0MzEzCWZpbGU6SGFuZHkuYXBwLnRhci5negpzZ0NON3BqVHRLcDA1Q0p6VExxSlZsNHJjRkErZ3U5K1d4NWN0WTFuY3U1MkpVVHpkRjJSckVTQ1RiNFVoeGY0VGNCNXVzeGhqNGZoWGhwK0VMQW5Ddz09Cg==";
        assert!(verify_signature(b"not the release", sig).is_err());
    }
}
