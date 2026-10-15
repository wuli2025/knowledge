"""Build the double-clickable offline viewer from data/knowledge.json."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import tempfile


ROOT = Path(__file__).resolve().parent


def build(data_path: Path, template_path: Path, output_path: Path) -> dict:
    data = json.loads(data_path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), list) or not isinstance(data.get("edges"), list):
        raise ValueError("知识库必须包含 nodes 和 edges 数组")
    ids = [str(node.get("id", "")) for node in data["nodes"]]
    if not all(ids) or len(ids) != len(set(ids)):
        raise ValueError("每个节点必须具有非空且唯一的 id")
    template = template_path.read_text(encoding="utf-8")
    # Keep the graph assets embedded so double-click / offline use still works.
    for marker, filename in (("__KB_MAP_CSS__", "mindmap.css"),
                             ("__KB_MAP_MODEL__", "mindmap_model.js"),
                             ("__KB_MAP_JS__", "mindmap.js")):
        if marker in template:
            template = template.replace(marker, (ROOT / filename).read_text(encoding="utf-8"))
    if template.count("__KB_DATA__") != 1:
        raise ValueError("模板必须包含且仅包含一个 __KB_DATA__ 数据占位符")
    # Script data is inert JSON. Escape HTML delimiters and JS line separators.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    for character, replacement in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"), ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        payload = payload.replace(character, replacement)
    html = template.replace("__KB_DATA__", payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    assets = ROOT / "assets" / "katex"
    target_assets = output_path.parent / "assets" / "katex"
    if assets.resolve() != target_assets.resolve():
        shutil.copytree(assets, target_assets, dirs_exist_ok=True)
    if not (target_assets / "katex.min.js").is_file() or not (target_assets / "katex.min.css").is_file():
        raise FileNotFoundError("缺少 assets/katex 本地公式资源")
    descriptor, temporary = tempfile.mkstemp(prefix=".kb-view-", suffix=".tmp", dir=output_path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(html)
        os.replace(temporary, output_path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {"output": str(output_path), "nodes": len(data["nodes"]), "edges": len(data["edges"])}


def main() -> None:
    parser = argparse.ArgumentParser(description="生成可直接双击使用的理化离线知识库")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "knowledge.json")
    parser.add_argument("--template", type=Path, default=ROOT / "kb_view.html")
    parser.add_argument("--output", type=Path, default=ROOT / "index.html")
    args = parser.parse_args()
    print(json.dumps(build(args.data.resolve(), args.template.resolve(), args.output.resolve()), ensure_ascii=False))


if __name__ == "__main__":
    main()
