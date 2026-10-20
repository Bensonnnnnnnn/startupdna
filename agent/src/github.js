import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Octokit } from "octokit";
import { ALLOWED_FILES, applyEdits } from "./edits.js";

function repoParts() {
  const spec = process.env.GITHUB_REPO || "";
  const [owner, repo] = spec.split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO must look like owner/name");
  return { owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

function redact(text, token) {
  let s = String(text || "");
  if (token) s = s.split(token).join("[redacted]");
  return s.replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]");
}

function gitEnv(token) {
  const basic = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}

function syncAndPush(dir, token, branch) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      try {
        run("git", ["pull", "--rebase", "origin", branch], dir, token);
      } catch {
        try {
          run("git", ["rebase", "--abort"], dir, token);
        } catch {
          /* already aborted or no rebase in progress */
        }
        throw new Error("GitHub was updated at the same time. Run /edit-text again.");
      }
      run("git", ["push", "origin", `HEAD:${branch}`], dir, token);
      return;
    } catch (err) {
      const msg = String(err.message || "");
      if (attempt === 1 && /rejected|fetch first|non-fast-forward/i.test(msg)) continue;
      throw err;
    }
  }
}

function run(cmd, args, cwd, token) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: cmd === "git" && token ? gitEnv(token) : { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (err) {
    const stderr = Buffer.isBuffer(err.stderr) ? err.stderr.toString("utf8") : String(err.stderr || "");
    throw new Error(redact(stderr || err.message, token).trim() || `${cmd} failed`);
  }
}

export function createGithub() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const octokit = new Octokit({ auth: token });

  return {
    async loadDocs() {
      const { owner, repo, branch } = repoParts();
      const docs = {};
      for (const file of ALLOWED_FILES) {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file,
          ref: branch,
        });
        if (Array.isArray(data) || data.type !== "file" || !data.content) {
          throw new Error(`could not read ${file}`);
        }
        const json = Buffer.from(data.content, "base64").toString("utf8");
        docs[file] = JSON.parse(json);
      }
      return docs;
    },

    async publish({ edits, summary, userTag }) {
      const { owner, repo, branch } = repoParts();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdna-"));
      try {
        run("git", [
          "clone",
          "--depth",
          "1",
          "--branch",
          branch,
          `https://github.com/${owner}/${repo}.git`,
          dir,
        ], undefined, token);
        const fresh = {};
        for (const file of ALLOWED_FILES) {
          fresh[file] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        }
        const { docs: next } = applyEdits(fresh, edits);
        for (const file of ALLOWED_FILES) {
          fs.writeFileSync(path.join(dir, file), `${JSON.stringify(next[file], null, 2)}\n`);
        }
        run("npm", ["install", "--omit=dev"], dir, token);
        run("node", ["build.js"], dir, token);
        run("git", ["config", "user.name", "Startup DNA Bot"], dir, token);
        run("git", ["config", "user.email", "bot@startupdna.local"], dir, token);
        run("git", ["add", "data", "startupdna"], dir, token);
        const status = run("git", ["status", "--porcelain"], dir, token).toString();
        if (!status.trim()) return { commit: null, url: null };
        const msg = `Update site copy from Discord.\n\n${summary}\n\nRequested by ${userTag}`.slice(0, 400);
        run("git", ["commit", "-m", msg], dir, token);
        syncAndPush(dir, token, branch);
        const sha = run("git", ["rev-parse", "HEAD"], dir, token).toString().trim();
        return {
          commit: sha,
          url: `https://github.com/${owner}/${repo}/commit/${sha}`,
        };
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
