import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Octokit } from "octokit";
import { ALLOWED_FILES } from "./edits.js";

function repoParts() {
  const spec = process.env.GITHUB_REPO || "";
  const [owner, repo] = spec.split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO must look like owner/name");
  return { owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

function git(token, args, cwd) {
  return execFileSync("git", ["-c", `http.extraHeader=Authorization: Bearer ${token}`, ...args], {
    cwd,
    stdio: "pipe",
  });
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

    async publish({ docs, summary, userTag }) {
      const { owner, repo, branch } = repoParts();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdna-"));
      git(token, [
        "clone",
        "--depth",
        "1",
        "--branch",
        branch,
        `https://github.com/${owner}/${repo}.git`,
        dir,
      ]);
      for (const file of ALLOWED_FILES) {
        fs.writeFileSync(path.join(dir, file), `${JSON.stringify(docs[file], null, 2)}\n`);
      }
      execFileSync("npm", ["install", "--omit=dev"], { cwd: dir, stdio: "pipe" });
      execFileSync("node", ["build.js"], { cwd: dir, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Startup DNA Bot"], { cwd: dir });
      execFileSync("git", ["config", "user.email", "bot@startupdna.local"], { cwd: dir });
      execFileSync("git", ["add", "data", "startupdna"], { cwd: dir });
      const status = execFileSync("git", ["status", "--porcelain"], { cwd: dir }).toString();
      if (!status.trim()) {
        fs.rmSync(dir, { recursive: true, force: true });
        return { commit: null, url: null };
      }
      const msg = `Update site copy from Discord.\n\n${summary}\n\nRequested by ${userTag}`.slice(0, 400);
      execFileSync("git", ["commit", "-m", msg], { cwd: dir });
      git(token, ["push", "origin", `HEAD:${branch}`], dir);
      const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();
      fs.rmSync(dir, { recursive: true, force: true });
      return {
        commit: sha,
        url: `https://github.com/${owner}/${repo}/commit/${sha}`,
      };
    },
  };
}
