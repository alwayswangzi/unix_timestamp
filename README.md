# Unix 时间戳工具

一个适合部署在 GitHub Pages 上的纯静态 Unix 时间戳工具。

## 功能

- 实时显示当前 Unix 秒级时间戳
- 支持暂停当前时间刷新
- 支持复制当前 Unix 秒
- 支持输入 Unix 秒级时间戳并转换为 UTC 时间
- 支持复制 UTC 时间
- 支持按年月日时分秒生成 Unix 秒级时间戳
- 支持全局选择 IANA 时区，并支持中文关键词搜索，例如越南、印尼

## 使用

直接打开 `index.html` 即可使用，无需构建步骤。

## GitHub Pages

仓库可直接通过 GitHub Pages 部署：

- Branch: `master`
- Folder: `/ (root)`

如果 Pages 已启用，访问地址通常为：

```text
https://alwayswangzi.github.io/unix_timestamp/
```

## 技术栈

- HTML
- CSS
- JavaScript
- Luxon CDN
