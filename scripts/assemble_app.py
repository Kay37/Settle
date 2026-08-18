from pathlib import Path
import base64
import gzip
import json

root = Path(__file__).resolve().parent.parent
assemble = root / "src" / "_assemble"
patches = json.loads((assemble / "patches.json").read_text())
parts = []
for i in range(2):
    s = (assemble / f"app.gz.b64.{i}").read_text().strip()
    for patch in patches:
        if patch["file"] == str(i):
            idx = patch["index"]
            s = s[:idx] + patch["to"] + s[idx + 1 :]
    parts.append(s)
data = gzip.decompress(base64.b64decode("".join(parts)))
out = root / "src" / "App.tsx"
out.write_bytes(data)
print("wrote", out, "bytes", len(data))
