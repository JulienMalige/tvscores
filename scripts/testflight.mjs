#!/usr/bin/env node
/**
 * Finish a TestFlight release: wait for Apple to process the build, give it
 * the release note from the top of CHANGELOG.md, and hand it to the internal
 * testers. Without the note a tester sees a version number and nothing else.
 *
 *   node scripts/testflight.mjs <build number> [--group "Internal"]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { asc } from "./asc.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ID = "6811973076";
const LOCALE = "en-US";
const MAX_NOTE = 4000;

/** One section of the changelog: the newest, or the first whose heading matches. */
export function section(markdown, match) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^## /.test(l) && (!match || match.test(l)));
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body.slice(0, MAX_NOTE);
}

/** What the next build carries. */
export const topSection = (markdown) => section(markdown);

export { setNote, waitForBuild };

async function waitForBuild(version, minutes = 15) {
  const deadline = Date.now() + minutes * 60e3;
  while (Date.now() < deadline) {
    const { data } = await asc(`/v1/apps/${APP_ID}/builds?limit=20`);
    const build = data.find((b) => b.attributes.version === String(version));
    if (build?.attributes.processingState === "VALID") return build;
    if (build?.attributes.processingState === "FAILED") throw new Error(`build ${version} failed processing`);
    console.log(`build ${version}: ${build?.attributes.processingState ?? "not uploaded yet"}`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  throw new Error(`build ${version} did not become valid in ${minutes} minutes`);
}

async function setNote(buildId, text) {
  if (!text) return console.log("no changelog entry; leaving the note empty");
  const existing = await asc(`/v1/builds/${buildId}/betaBuildLocalizations`);
  const mine = existing.data.find((l) => l.attributes.locale === LOCALE);
  const body = JSON.stringify(mine
    ? { data: { type: "betaBuildLocalizations", id: mine.id, attributes: { whatsNew: text } } }
    : {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale: LOCALE, whatsNew: text },
          relationships: { build: { data: { type: "builds", id: buildId } } },
        },
      });
  await asc(mine ? `/v1/betaBuildLocalizations/${mine.id}` : "/v1/betaBuildLocalizations", { method: mine ? "PATCH" : "POST", body });
  console.log(`note set (${text.length} characters)`);
}

async function addToGroup(buildId, name) {
  const groups = await asc(`/v1/apps/${APP_ID}/betaGroups`);
  const group = groups.data.find((g) => g.attributes.name === name);
  if (!group) throw new Error(`no beta group called ${name}`);
  await asc(`/v1/betaGroups/${group.id}/relationships/builds`, {
    method: "POST",
    body: JSON.stringify({ data: [{ type: "builds", id: buildId }] }),
  });
  console.log(`added to ${name}`);
}

if (process.argv[1] && process.argv[1].endsWith("testflight.mjs")) {
  const version = process.argv[2];
  const groupIndex = process.argv.indexOf("--group");
  const group = groupIndex === -1 ? "Internal" : process.argv[groupIndex + 1];
  if (!version) {
    console.error("usage: testflight.mjs <build number> [--group NAME]");
    process.exit(2);
  }
  try {
    const build = await waitForBuild(version);
    await setNote(build.id, topSection(readFileSync(join(ROOT, "CHANGELOG.md"), "utf8")));
    await addToGroup(build.id, group);
    console.log(`build ${version} is ready for testers`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
