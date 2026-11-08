// expo-file-system stub (resilience.test.cjs) — SDK 54+ YENİ API (Paths/File/Directory). Ana
// girişten export edilir; legacy ayrı modüldür. native-selfcheck File/Directory kurucularını arar.
class File {
  constructor() {}
  get exists() {
    return false;
  }
  write() {}
  async base64() {
    return "";
  }
  delete() {}
}
class Directory {
  constructor() {}
  get exists() {
    return false;
  }
  create() {}
  list() {
    return [];
  }
}
module.exports = { Paths: { cache: "/cache" }, File, Directory };
