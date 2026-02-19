import path from "path";
import fs from "fs";
import os from "os";

const cwd = process.cwd();
const hasExclamation = cwd.includes("!");

// When path contains "!" (e.g. "Hashed Vibe Haus!"), Webpack fails. Use a symlink at a safe path.
let safeProjectPath = cwd;
if (hasExclamation) {
  const safeDir = path.join(os.tmpdir(), "next-safe-path");
  safeProjectPath = path.join(safeDir, path.basename(cwd));
  try {
    fs.mkdirSync(safeDir, { recursive: true });
    if (fs.existsSync(safeProjectPath)) {
      const target = fs.readlinkSync(safeProjectPath);
      if (target !== cwd) {
        fs.unlinkSync(safeProjectPath);
        fs.symlinkSync(cwd, safeProjectPath);
      }
    } else {
      fs.symlinkSync(cwd, safeProjectPath);
    }
  } catch (err) {
    console.warn("Could not create symlink for path with '!', dev may fail:", err.message);
  }
}

function replacePathIn(obj, from, to) {
  if (!obj || from === to) return;
  if (typeof obj === "string") {
    if (obj === from) return to;
    if (obj.startsWith(from + path.sep)) return to + obj.slice(from.length);
    return obj;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const out = replacePathIn(item, from, to);
      if (typeof out === "string") obj[i] = out;
    });
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string") {
      if (val === from || val.startsWith(from + path.sep)) {
        obj[key] = val === from ? to : to + val.slice(from.length);
      }
    } else if (val && typeof val === "object") {
      replacePathIn(val, from, to);
    }
  }
  return obj;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  ...(hasExclamation && safeProjectPath !== cwd
    ? { distDir: path.join(safeProjectPath, ".next") }
    : {}),
  webpack: (config, { dev, isServer }) => {
    if (hasExclamation && safeProjectPath !== cwd) {
      replacePathIn(config, cwd, safeProjectPath);
    }
    return config;
  },
};

export default nextConfig;
