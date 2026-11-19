use serde_json::{json, Value};
use std::{env, path::Path, process::{Command, Stdio}};

#[derive(Debug, PartialEq)]
struct Project {
    organization: String,
    project: String,
    repository: String,
}

fn decode_segment(value: &str) -> Result<String, String> {
    let mut bytes = Vec::new();
    let mut input = value.as_bytes().iter().copied();
    while let Some(byte) = input.next() {
        bytes.push(if byte == b'%' {
            let high = input.next().and_then(|c| (c as char).to_digit(16));
            let low = input.next().and_then(|c| (c as char).to_digit(16));
            ((high.ok_or("Invalid Azure DevOps remote.")? << 4) | low.ok_or("Invalid Azure DevOps remote.")?) as u8
        } else { byte });
    }
    String::from_utf8(bytes).map_err(|_| "Invalid Azure DevOps remote.".into())
}

fn project_from_remote(remote: &str) -> Result<Project, String> {
    let remote = remote.trim();
    let url = if let Some(path) = remote.strip_prefix("git@ssh.dev.azure.com:v3/") {
        format!("https://dev.azure.com/{path}")
    } else { remote.to_string() };
    let url = reqwest::Url::parse(&url).map_err(|_| "This repository has no Azure DevOps origin.")?;
    let host = url.host_str().unwrap_or("");
    let mut parts: Vec<String> = url.path_segments().into_iter().flatten().filter(|part| !part.is_empty())
        .map(decode_segment).collect::<Result<_, _>>()?;
    let organization = if host == "dev.azure.com" || host == "ssh.dev.azure.com" {
        if host == "ssh.dev.azure.com" && parts.first().is_some_and(|part| part == "v3") { parts.remove(0); }
        if parts.is_empty() { return Err("Invalid Azure DevOps remote.".into()); }
        parts.remove(0)
    } else if let Some(org) = host.strip_suffix(".visualstudio.com") {
        if parts.first().is_some_and(|part| part == "DefaultCollection") { parts.remove(0); }
        org.to_string()
    } else { return Err("This repository has no Azure DevOps origin.".into()); };
    if organization.is_empty() || !organization.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_') {
        return Err("Invalid Azure DevOps organization.".into());
    }
    let project = match parts.as_slice() {
        [project, git, _repo] if git == "_git" => project.clone(),
        [git, repo] if git == "_git" => repo.clone(),
        [project, _repo] => project.clone(),
        _ => return Err("Cannot determine the Azure DevOps project from this origin.".into()),
    };
    let repository = parts.last().unwrap().clone();
    Ok(Project { repository, organization: format!("https://dev.azure.com/{organization}"), project })
}

fn wiql(project: &str, search: &str) -> String {
    let literal = |value: &str| format!("'{}'", value.replace('\'', "''"));
    let search = search.trim();
    let id = search.strip_prefix('#').unwrap_or(search).parse::<u64>().ok();
    let filter = if search.is_empty() {
        "[System.AssignedTo] = @Me AND [System.State] NOT IN ('Closed', 'Done', 'Removed')".into()
    } else if let Some(id) = id {
        format!("[System.Id] = {id}")
    } else { format!("[System.Title] CONTAINS {}", literal(search)) };
    format!("SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = {} AND ({filter}) ORDER BY [System.ChangedDate] DESC", literal(project))
}

fn azure_cli() -> Result<Command, String> {
    #[cfg(windows)]
    {
        for directory in env::split_paths(&env::var_os("PATH").unwrap_or_default()) {
            let executable = directory.join("az.exe");
            let python = directory.join("..").join("python.exe");
            let mut command = if executable.is_file() { Command::new(executable) }
            else if directory.join("az.cmd").is_file() && python.is_file() {
                let mut command = Command::new(python);
                command.args(["-I", "-B", "-X", "utf8", "-m", "azure.cli"]);
                command
            } else { continue; };
            use std::os::windows::process::CommandExt;
            // GitGoblin launches Azure CLI without the console window the Windows account broker expects.
            command.creation_flags(0x08000000).env("AZURE_CORE_ENABLE_BROKER_ON_WINDOWS", "false")
                .env("PYTHONIOENCODING", "utf-8");
            return Ok(command);
        }
        Err("Install Azure CLI and its Azure DevOps extension.".into())
    }
    #[cfg(not(windows))]
    { Ok(Command::new("az")) }
}

fn ticket_results(project: &Project, items: &Value) -> Value {
    let tickets: Vec<Value> = items.as_array().into_iter().flatten().take(30).filter_map(|item| {
        let id = item.get("id")?.as_u64()?;
        let fields = item.get("fields")?;
        let mut url = reqwest::Url::parse(&project.organization).ok()?;
        url.path_segments_mut().ok()?.extend([project.project.as_str(), "_workitems", "edit", &id.to_string()]);
        Some(json!({
            "id": id, "title": fields.get("System.Title").and_then(Value::as_str).unwrap_or("Untitled ticket"),
            "state": fields.get("System.State").and_then(Value::as_str).unwrap_or(""),
            "kind": fields.get("System.WorkItemType").and_then(Value::as_str).unwrap_or(""),
            "assignedTo": fields.pointer("/System.AssignedTo/displayName").and_then(Value::as_str).unwrap_or(""),
            "url": url.as_str(),
        }))
    }).collect();
    json!({ "organization": project.organization, "project": project.project, "tickets": tickets })
}

pub fn tickets(repo: &str, search: &str) -> Result<Value, String> {
    if search.chars().count() > 200 { return Err("Search by a ticket number or a shorter title.".into()); }
    let repo = std::fs::canonicalize(Path::new(repo)).map_err(|_| "Choose a local worktree to search its Azure DevOps project.")?;
    let remote = crate::git::command(&repo).args(["remote", "get-url", "origin"]).output().map_err(|_| "Cannot read the repository origin.")?;
    if !remote.status.success() { return Err("This repository has no origin. Enter a ticket reference manually.".into()); }
    let project = project_from_remote(&String::from_utf8_lossy(&remote.stdout))?;
    let output = azure_cli()?.current_dir(&repo).args([
        "boards", "query", "--org", &project.organization, "--project", &project.project,
        "--wiql", &wiql(&project.project, search), "--output", "json", "--only-show-errors",
    ]).env("AZURE_EXTENSION_USE_DYNAMIC_INSTALL", "no").stdin(Stdio::null()).output()
        .map_err(|_| "Cannot start Azure CLI. Install its Azure DevOps extension and sign in first.")?;
    if !output.status.success() {
        return Err("Azure DevOps search failed. Check your Azure CLI sign-in and access to this project, then retry.".into());
    }
    // Azure CLI returns no output when a WIQL query finds no tickets.
    let items = if output.stdout.is_empty() { json!([]) } else {
        serde_json::from_slice(&output.stdout).map_err(|_| "Azure DevOps returned an unexpected response.")?
    };
    if !items.is_array() { return Err("Azure DevOps returned an unexpected response.".into()); }
    Ok(ticket_results(&project, &items))
}

pub fn sign_in() -> Result<(), String> {
    let output = azure_cli()?.args(["login", "--allow-no-subscriptions", "--output", "none", "--only-show-errors"])
        .stdin(Stdio::null()).output().map_err(|e| e.to_string())?;
    if output.status.success() { return Ok(()); }
    Err(sign_in_error(&String::from_utf8_lossy(&output.stderr)))
}

fn sign_in_error(stderr: &str) -> String {
    let reason = stderr.lines().find_map(|line| line.trim().strip_prefix("ERROR:"))
        .map(str::trim).filter(|line| !line.is_empty()).unwrap_or("Please retry sign-in in your browser.");
    format!("Azure CLI sign-in failed. {reason}")
}

fn repository_project(repo: &str) -> Result<Project, String> {
    let remote = crate::git::command(Path::new(repo)).args(["remote", "get-url", "origin"])
        .output().map_err(|e| e.to_string())?;
    if !remote.status.success() { return Err("This repository has no origin.".into()); }
    project_from_remote(&String::from_utf8_lossy(&remote.stdout))
}

fn personal_vote(pr: &Value, reviewer_id: &str) -> Option<i64> {
    let reviewer = pr["reviewers"].as_array()?.iter().find(|r|
        r["id"].as_str().is_some_and(|id| id.eq_ignore_ascii_case(reviewer_id)))?;
    if reviewer["hasDeclined"] == true { return None; }
    reviewer["vote"].as_i64()
}

pub fn pull_requests(repo: &str) -> Result<Value, String> {
    let project = repository_project(repo)?;
    let output = azure_cli()?.args(["repos", "pr", "list", "--org", &project.organization,
        "--project", &project.project, "--repository", &project.repository, "--status", "active",
        "--output", "json", "--only-show-errors"])
        .env("AZURE_EXTENSION_USE_DYNAMIC_INSTALL", "no").stdin(Stdio::null()).output()
        .map_err(|_| "Cannot start Azure CLI.")?;
    if !output.status.success() {
        return Err("Could not list pull requests. Check your Azure sign-in, repository access and Azure DevOps CLI extension.".into());
    }
    let items: Vec<Value> = serde_json::from_slice(&output.stdout).map_err(|_| "Invalid pull request response.")?;
    let reviewer = if items.is_empty() { None } else { current_reviewer(&project).ok() };
    let mut result = Vec::new();
    for item in items {
        let id = item["pullRequestId"].as_u64().ok_or("Missing pull request ID.")?;
        let mut url = reqwest::Url::parse(&project.organization).map_err(|e| e.to_string())?;
        url.path_segments_mut().unwrap().extend([project.project.as_str(), "_git", &project.repository, "pullrequest", &id.to_string()]);
        let vote = reviewer.as_ref().and_then(|id| personal_vote(&item, id));
        result.push(json!({ "id": id, "title": item["title"], "url": url.as_str(),
            "myVote": vote,
            "needsReview": reviewer.as_ref().map(|_| item["isDraft"] != true && vote == Some(0)),
            "repositoryId": item.pointer("/repository/id").and_then(Value::as_str).ok_or("Missing Azure repository ID.")?,
            "createdAt": item["creationDate"], "draft": item["isDraft"].as_bool().unwrap_or(false),
            "author": item.pointer("/createdBy/displayName").and_then(Value::as_str).unwrap_or("Unknown author"),
            "source": item["sourceRefName"].as_str().unwrap_or("").trim_start_matches("refs/heads/"),
            "target": item["targetRefName"].as_str().unwrap_or("").trim_start_matches("refs/heads/"),
            "base": item.pointer("/lastMergeTargetCommit/commitId"), "head": item.pointer("/lastMergeSourceCommit/commitId") }));
    }
    Ok(json!(result))
}

fn reviewer_request(url: &str, method: &str, body_file: Option<&Path>, failure: &str) -> Result<Value, String> {
    let mut command = azure_cli()?;
    command.args(["rest", "--url", url, "--method", method, "--resource", "499b84ac-1321-427f-aa17-267ca6975798",
        "--output", "json", "--only-show-errors"]);
    if let Some(path) = body_file {
        command.args(["--headers", "Content-Type=application/json", "--body"])
            .arg(format!("@{}", path.display()));
    }
    let output = command.stdin(Stdio::null()).output().map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(failure.into()); }
    serde_json::from_slice(&output.stdout).map_err(|_| "Unexpected reviewer response from Azure DevOps.".into())
}

fn current_reviewer(project: &Project) -> Result<String, String> {
    let connection = reviewer_request(&format!("{}/_apis/connectionData", project.organization), "GET", None,
        "Could not identify your Azure CLI account in this organization. Check your Azure CLI sign-in.")?;
    connection.pointer("/authenticatedUser/id").and_then(Value::as_str)
        .map(str::to_owned).ok_or_else(|| "Azure DevOps did not identify the current reviewer.".into())
}

pub fn review_vote(repo: &str, repository_id: &str, id: u64, vote: Option<&str>) -> Result<Value, String> {
    let project = repository_project(repo)?;
    let reviewer = current_reviewer(&project)?;
    let mut url = reqwest::Url::parse(&project.organization).map_err(|e| e.to_string())?;
    url.path_segments_mut().unwrap().extend([project.project.as_str(), "_apis", "git", "repositories", repository_id,
        "pullRequests", &id.to_string(), "reviewers"]);
    url.set_query(Some("api-version=7.1"));
    if let Some(choice) = vote {
        let body = match choice {
            "decline" => json!({"hasDeclined": true}),
            _ => {
                let value = match choice {
                    "approve" => 10, "suggestions" => 5, "wait" => -5, "reject" => -10, "reset" => 0,
                    _ => return Err("Unknown review vote.".into()),
                };
                json!({"id": reviewer, "vote": value, "hasDeclined": false})
            }
        };
        let file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
        serde_json::to_writer(file.as_file(), &body).map_err(|e| e.to_string())?;
        url.path_segments_mut().unwrap().push(&reviewer);
        let method = if choice == "decline" { "PATCH" } else { "PUT" };
        return reviewer_request(url.as_str(), method, Some(file.path()), "Azure DevOps could not save your review decision.");
    }
    let reviewers = reviewer_request(url.as_str(), "GET", None, "Azure DevOps could not load reviewers for this pull request.")?;
    let list = reviewers.as_array().or_else(|| reviewers["value"].as_array()).ok_or("Invalid reviewer list.")?;
    Ok(list.iter().find(|r| r["id"].as_str().is_some_and(|id| id.eq_ignore_ascii_case(&reviewer))).cloned().unwrap_or(Value::Null))
}

pub fn pull_request_diff(repo: &str, base: &str, head: &str) -> Result<String, String> {
    for oid in [base, head] {
        if oid.len() != 40 || !oid.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("Azure DevOps has not supplied both PR commits. Refresh and retry.".into());
        }
    }
    let git = || crate::git::command(Path::new(repo));
    if [base, head].iter().any(|oid| !git().args(["cat-file", "-e", oid]).output().is_ok_and(|o| o.status.success())) {
        let fetch = git().args(["fetch", "--no-tags", "--no-write-fetch-head", "--refmap=", "origin", base, head])
            .output().map_err(|e| e.to_string())?;
        if !fetch.status.success() { return Err("Could not fetch PR commits from origin. Check Git credentials and refresh the PR list.".into()); }
    }
    let output = git().args(["diff", "--no-ext-diff", "--no-textconv", "--find-renames", &format!("{base}...{head}"), "--"])
        .output().map_err(|e| e.to_string())?;
    if !output.status.success() { return Err("Could not compare PR commits. Check that the clone contains their common history.".into()); }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reports_cli_sign_in_error_without_unrelated_output() {
        assert_eq!(sign_in_error("WARNING: opening browser\nERROR: account unavailable\nextra output"),
            "Azure CLI sign-in failed. account unavailable");
        assert!(sign_in_error("").contains("retry sign-in"));
    }

    #[test]
    fn uses_only_the_signed_in_reviewers_vote() {
        let mut pr = json!({"reviewers": [{"id":"other","vote":-10}, {"id":"ME","vote":10}]});
        assert_eq!(personal_vote(&pr, "me"), Some(10));
        assert_eq!(personal_vote(&pr, "other"), Some(-10));
        assert_eq!(personal_vote(&pr, "unassigned"), None);
        for vote in [0, 5, -5, -10] {
            pr["reviewers"][1]["vote"] = json!(vote);
            assert_eq!(personal_vote(&pr, "me"), Some(vote));
        }
        pr["reviewers"][1]["hasDeclined"] = json!(true);
        assert_eq!(personal_vote(&pr, "me"), None);
    }

    #[test]
    #[ignore = "requires Azure CLI sign-in and a readable Azure DevOps PR"]
    fn reads_current_vote_from_azure() {
        let repo = tempfile::tempdir().unwrap();
        let origin = env::var("GITGOBLIN_TEST_AZURE_ORIGIN").unwrap();
        let repository_id = env::var("GITGOBLIN_TEST_AZURE_REPOSITORY_ID").unwrap();
        let pr = env::var("GITGOBLIN_TEST_AZURE_PR").unwrap().parse().unwrap();
        for args in [vec!["init"], vec!["remote", "add", "origin", &origin]] {
            assert!(crate::git::command(repo.path()).args(args).output().unwrap().status.success());
        }
        let vote = review_vote(repo.path().to_str().unwrap(), &repository_id, pr, None).unwrap();
        assert!(vote.is_null() || vote["vote"].is_number());
    }

    #[test]
    fn recognizes_azure_remote_formats_and_decodes_project_names() {
        for remote in ["https://dev.azure.com/Acme/My%20Project/_git/Repo", "git@ssh.dev.azure.com:v3/Acme/My%20Project/Repo", "ssh://git@ssh.dev.azure.com/v3/Acme/My%20Project/Repo", "https://Acme.visualstudio.com/DefaultCollection/My%20Project/_git/Repo"] {
            let project = project_from_remote(remote).unwrap();
            assert_eq!(project.organization.to_lowercase(), "https://dev.azure.com/acme");
            assert_eq!(project.project, "My Project");
            assert_eq!(project.repository, "Repo");
        }
        assert_eq!(project_from_remote("https://dev.azure.com/Acme/_git/Rex").unwrap().project, "Rex");
        assert!(project_from_remote("https://github.com/Acme/Repo").is_err());
        assert!(project_from_remote("https://dev.azure.com.evil.test/Acme/Project/_git/Repo").is_err());
    }
    #[test]
    fn searches_ids_or_escaped_titles_within_the_repository_project() {
        assert!(wiql("Rex", "").contains("[System.AssignedTo] = @Me"));
        assert!(wiql("Rex", "#42").contains("[System.Id] = 42"));
        let query = wiql("Team's Project", "O'Brien");
        assert!(query.contains("[System.TeamProject] = 'Team''s Project'"));
        assert!(query.contains("[System.Title] CONTAINS 'O''Brien'"));
        assert!(!query.contains("@project"));
    }
    #[test]
    fn maps_ticket_fields_and_builds_a_browser_reference() {
        let project = Project { organization: "https://dev.azure.com/Acme".into(), repository: "Repo".into(), project: "My Project".into() };
        let result = ticket_results(&project, &json!([{ "id":42, "fields":{
            "System.Title":"Fix login", "System.State":"Active", "System.WorkItemType":"Bug",
            "System.AssignedTo": {"displayName":"Developer"}
        }}]));
        assert_eq!(result["tickets"][0]["url"], "https://dev.azure.com/Acme/My%20Project/_workitems/edit/42");
        assert_eq!(result["tickets"][0]["assignedTo"], "Developer");
    }
}
