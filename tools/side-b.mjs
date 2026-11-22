#!/usr/bin/env node
// Side B cifrato.
//
// Il contenuto del Side B (sezioni, cifre, agenda) non sta mai in chiaro nel sito:
// viene cifrato con AES-GCM e la chiave viaggia solo nel link (#<chiave>), che il
// browser non manda al server. Senza chiave, con una chiave vecchia o dopo la
// scadenza, la pagina mostra solo "Questo link non è più attivo".
//
// Cifrare (nuova chiave = tutti i link vecchi smettono di funzionare):
//   node tools/side-b.mjs build <contenuto.html> --days 30 [--key <chiave>]
// Recuperare il contenuto in chiaro dalla pagina pubblicata:
//   node tools/side-b.mjs decrypt --key <chiave> > contenuto.html
//
// Il file con il contenuto in chiaro NON va messo nel repository.

import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "contributo-4tlwp7", "index.html");
const START = "<!-- side-b:payload -->";
const END = "<!-- /side-b:payload -->";

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const fromB64url = (text) => new Uint8Array(Buffer.from(text, "base64url"));
// La chiave nel link è esadecimale: solo lettere e cifre, nessun simbolo.
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const fromHex = (text) => new Uint8Array(Buffer.from(text, "hex"));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

async function importKey(raw) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function build() {
  const source = process.argv[3];
  if (!source) throw new Error("Manca il file con il contenuto in chiaro.");
  const days = Number(arg("days", "30"));
  const raw = arg("key") ? fromHex(arg("key")) : crypto.getRandomValues(new Uint8Array(32));
  const expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const payload = JSON.stringify({ expires, html: readFileSync(source, "utf8") });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(raw), new TextEncoder().encode(payload));
  const block = `${START}\n    <script type="application/octet-stream" id="side-b-payload">${b64url(iv)}.${b64url(data)}</script>\n    ${END}`;
  const html = readFileSync(page, "utf8");
  const from = html.indexOf(START);
  const to = html.indexOf(END) + END.length;
  if (from < 0 || to < END.length) throw new Error("Segnaposto del contenuto non trovato nella pagina.");
  writeFileSync(page, html.slice(0, from) + block + html.slice(to));
  console.log(`Chiave: ${hex(raw)}`);
  console.log(`Scadenza: ${expires}`);
  console.log(`Link: …/contributo-4tlwp7/#${hex(raw)}`);
}

async function decrypt() {
  const html = readFileSync(page, "utf8");
  const match = html.match(/id="side-b-payload">([^<]+)</);
  const [iv, data] = match[1].split(".").map(fromB64url);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await importKey(fromHex(arg("key"))), data);
  const payload = JSON.parse(new TextDecoder().decode(plain));
  console.error(`Scadenza: ${payload.expires}`);
  process.stdout.write(payload.html);
}

const command = process.argv[2];
(command === "build" ? build() : command === "decrypt" ? decrypt() : Promise.reject(new Error("Comando: build | decrypt")))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
