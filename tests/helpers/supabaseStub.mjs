/**
 * Stand-in for @supabase/supabase-js, loaded in place of the real thing by
 * helpers/loader.mjs.
 *
 * It records every storage call, which is what lets a test assert that a
 * rejected request never reached storage at all. "Returned a 400" and "did
 * not write the file" are different claims, and only the second one matters.
 */
export const calls = [];
export let uploadResult = { error: null };

export function setUploadResult(r) {
  uploadResult = r;
}

export function reset() {
  calls.length = 0;
  uploadResult = { error: null };
}

export function createClient() {
  return {
    storage: {
      from(bucket) {
        return {
          async upload(path, bytes, opts) {
            calls.push({ op: "upload", bucket, path, size: bytes?.length, opts });
            return uploadResult;
          },
          async remove(paths) {
            calls.push({ op: "remove", bucket, paths });
            return { error: null };
          },
        };
      },
    },
  };
}
