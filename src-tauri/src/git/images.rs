use super::*;

const LIMIT: u64 = 8 * 1024 * 1024;

fn blob(repo: &Path, revision: &str, path: &str) -> Result<Option<Vec<u8>>, String> {
    let listing = if revision == ":" {
        git(repo, &["ls-files", "--stage", "-z", "--", path])?
    } else {
        git(repo, &["ls-tree", "-z", revision, "--", path])?
    };
    let Some(entry) = listing.split('\0').find(|entry| {
        entry.split_once('\t').is_some_and(|(_, name)| name == path)
    }) else { return Ok(None) };
    let fields: Vec<_> = entry.split_once('\t').unwrap().0.split_whitespace().collect();
    if !matches!(fields[0], "100644" | "100755") {
        return Err("Image previews require a regular file.".into());
    }
    if revision == ":" && fields[2] != "0" {
        return Err("Resolve this image's merge conflict to preview it.".into());
    }
    let id = fields[if revision == ":" { 1 } else { 2 }];
    let size: u64 = git(repo, &["cat-file", "-s", id])?.trim().parse().map_err(|_| "Invalid image size")?;
    if size > LIMIT { return Err("Image preview is limited to 8 MiB per version.".into()) }
    bytes(repo, &["cat-file", "blob", id], None).map(Some)
}

pub(super) fn diff(repo: &Path, req: &Request) -> Result<Value, String> {
    relative(&req.path)?;
    let extension = Path::new(&req.path).extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif",
        "webp" => "image/webp", "bmp" => "image/bmp", "ico" => "image/x-icon",
        "svg" => "image/svg+xml", "avif" => "image/avif",
        _ => return Err("This image format cannot be previewed.".into()),
    };
    let (before, after) = match req.mode.as_str() {
        "working" => (Some(":".to_string()), None),
        "staged" => (oid(repo, "HEAD").ok(), Some(":".to_string())),
        "branch" => {
            let target = oid(repo, &req.target)?;
            (Some(git(repo, &["merge-base", "HEAD", &target])?.trim().to_string()), None)
        }
        "history" => {
            let target = oid(repo, &req.target)?;
            let parents = git(repo, &["rev-list", "--parents", "-n", "1", &target])?;
            (parents.split_whitespace().nth(1).map(str::to_string), Some(target))
        }
        _ => return Err("Unknown image comparison mode.".into()),
    };
    let old_path = if req.text.is_empty() { &req.path } else { relative(&req.text)?; &req.text };
    let original = before.as_deref().map(|rev| blob(repo, rev, old_path)).transpose()?.flatten();
    let modified = if let Some(rev) = after {
        blob(repo, &rev, &req.path)?
    } else {
        match fs::symlink_metadata(repo.join(&req.path)) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(e.to_string()),
            Ok(meta) => {
                if !meta.is_file() { return Err("Image previews require a regular file.".into()) }
                if meta.len() > LIMIT { return Err("Image preview is limited to 8 MiB per version.".into()) }
                Some(fs::read(file_path(repo, &req.path)?).map_err(|e| e.to_string())?)
            }
        }
    };
    Ok(json!({ "mime": mime, "original": original, "modified": modified }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::tests::{fixture, request};

    #[test]
    fn image_diff_reads_each_git_version_and_absent_sides() {
        let dir = fixture();
        let repo = fs::canonicalize(dir.path()).unwrap();
        let mut req = request(&repo, "image-diff");
        req.path = "image.png".into();
        req.mode = "working".into();
        fs::write(repo.join(&req.path), [1, 2, 3]).unwrap();
        assert_eq!(diff(&repo, &req).unwrap()["original"], Value::Null);
        git(&repo, &["add", "."]).unwrap();
        req.mode = "staged".into();
        assert_eq!(diff(&repo, &req).unwrap()["modified"], json!([1, 2, 3]));
        assert_eq!(diff(&repo, &req).unwrap()["original"], Value::Null);
        git(&repo, &["commit", "-m", "initial"]).unwrap();
        fs::write(repo.join(&req.path), [4, 5]).unwrap();
        git(&repo, &["add", "."]).unwrap();
        fs::write(repo.join(&req.path), [6]).unwrap();
        let staged = diff(&repo, &req).unwrap();
        assert_eq!(staged["original"], json!([1, 2, 3]));
        assert_eq!(staged["modified"], json!([4, 5]));
        req.mode = "working".into();
        let working = diff(&repo, &req).unwrap();
        assert_eq!(working["original"], json!([4, 5]));
        assert_eq!(working["modified"], json!([6]));
        req.mode = "branch".into();
        req.target = "HEAD".into();
        assert_eq!(diff(&repo, &req).unwrap()["original"], json!([1, 2, 3]));
        req.mode = "history".into();
        assert_eq!(diff(&repo, &req).unwrap()["original"], Value::Null);
        assert_eq!(diff(&repo, &req).unwrap()["modified"], json!([1, 2, 3]));
        git(&repo, &["mv", "image.png", "renamed.png"]).unwrap();
        git(&repo, &["commit", "-m", "rename"]).unwrap();
        req.path = "renamed.png".into();
        req.text = "image.png".into();
        assert_eq!(diff(&repo, &req).unwrap()["original"], json!([1, 2, 3]));
        req.text.clear();
        fs::remove_file(repo.join(&req.path)).unwrap();
        req.mode = "working".into();
        assert_eq!(diff(&repo, &req).unwrap()["modified"], Value::Null);
        req.path = "../outside.png".into();
        assert!(diff(&repo, &req).is_err());
        req.path = "large.png".into();
        fs::File::create(repo.join(&req.path)).unwrap().set_len(LIMIT + 1).unwrap();
        assert!(diff(&repo, &req).unwrap_err().contains("8 MiB"));
    }
}
