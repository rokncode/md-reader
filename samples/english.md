# A calm place to read

Qari is a Markdown reader that gets out of the way. There is **no sidebar** — the document fills the window, and the chrome floats above it in glass.

## Mixed direction

Every block picks its own direction from its first strong character:

هذه الفقرة عربية داخل مستند إنجليزي، وتُعرض من اليمين إلى اليسار تلقائياً.

And this one goes back to left-to-right.

1. First item
2. البند الثاني بالعربية
3. Third item

## Code

```rust
fn main() {
    println!("Hello from Qari");
}
```

> [!NOTE]
> Relative links work: go [back to the Arabic readme](README.md#لماذا-قارئ).

<details>
<summary>Raw HTML works too (sanitized)</summary>

Hidden content inside `<details>`.

</details>
