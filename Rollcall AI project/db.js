/* Rollcall — database layer (IndexedDB) */
(function (root) {
  "use strict";

  const NAME = "rollcall_ams";
  const VERSION = 1;

  const SCHEMA = {
    users:           { key: "id", indexes: [["username", "username", true], ["role", "role", false]] },
    students:        { key: "id", indexes: [["usn", "usn", true]] },
    subjects:        { key: "id", indexes: [] },
    sessions:        { key: "id", indexes: [["subjectDate", ["subjectId", "date"], false]] },
    attendance:      { key: "id", indexes: [["sessionId", "sessionId", false], ["studentId", "studentId", false], ["status", "status", false]] },
    challenges:      { key: "id", indexes: [["studentId", "studentId", false]] },
    classChallenges: { key: "id", indexes: [] },
    ledger:          { key: "id", indexes: [["studentId", "studentId", false]] },
    badges:          { key: "id", indexes: [["studentId", "studentId", false]] },
    settings:        { key: "key", indexes: [] }
  };

  const STORES = Object.keys(SCHEMA);
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((name) => {
          if (db.objectStoreNames.contains(name)) return;
          const store = db.createObjectStore(name, { keyPath: SCHEMA[name].key });
          SCHEMA[name].indexes.forEach(([idx, path, unique]) => {
            store.createIndex(idx, path, { unique });
          });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database is open in another tab. Close other tabs and reload."));
    });
    return dbPromise;
  }

  async function loadAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, "readonly");
      const out = {};
      STORES.forEach((name) => {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => { out[name] = r.result; };
      });
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function putMany(pairs) {
    if (!pairs.length) return;
    const db = await open();
    const names = [...new Set(pairs.map((p) => p[0]))];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, "readwrite");
      pairs.forEach(([store, rec]) => tx.objectStore(store).put(rec));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const put = (store, rec) => putMany([[store, rec]]);

  async function removeMany(pairs) {
    if (!pairs.length) return;
    const db = await open();
    const names = [...new Set(pairs.map((p) => p[0]))];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, "readwrite");
      pairs.forEach(([store, key]) => tx.objectStore(store).delete(key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function replaceAll(snapshot) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, "readwrite");
      STORES.forEach((name) => {
        const store = tx.objectStore(name);
        store.clear();
        (snapshot[name] || []).forEach((rec) => store.put(rec));
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  root.DB = { open, loadAll, put, putMany, removeMany, replaceAll, SCHEMA, STORES };
})(window);