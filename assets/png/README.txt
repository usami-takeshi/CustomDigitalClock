【連番画像（PNG）素材の配置場所】

Procreate や After Effects から書き出した透過連番PNG画像を、
遷移パターンごとのフォルダに分けて配置してください。

■ フォルダ構成 & ファイル命名ルール:
  assets/png/{変化前}_to_{変化後}/frame_00.png 〜 frame_29.png

  例:
  assets/png/
  ├── 0_to_1/
  │   ├── frame_00.png
  │   ├── frame_01.png
  │   ├── ...
  │   └── frame_29.png （計30枚）
  ├── 1_to_2/
  │   ├── frame_00.png
  │   └── ...
  └── 9_to_0/
      ├── frame_00.png
      └── ...

■ 連番ファイル名ルール（デフォルト）:
  - プレフィックス: frame_
  - 桁数: 2桁（00 〜 29）
  - 枚数: 30フレーム（30fpsでちょうど1秒間）
  - 解像度: 500 x 500 px (透過PNG)

※ 書き出しツールの都合で「000.png」「img_01.png」などの形式になる場合は、
   `script.js` 冒頭の `ASSET_CONFIG.png` 内にある `prefix` や `padLength` を
   書き換えることで自由に対応できます。
