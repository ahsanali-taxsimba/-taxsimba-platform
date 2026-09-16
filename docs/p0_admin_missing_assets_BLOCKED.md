# BLOCKED PENDING ORIGINAL ADMIN PUBLIC ASSETS FROM TOXEL

No legitimate Git history on any audited remote branch contains
`tax_simba_admin_frontend/public/**` binaries.

Do **not** invent replacements. Do **not** copy SEO/PPC assets.

## Exact missing paths Toxel must provide

Paths are shown as they should appear under `tax_simba_admin_frontend/public/`
(Next.js serves them under `basePath` `/admin`).

### Critical UAT surfaces

| Referenced in source | Required public file |
| --- | --- |
| `./images/logo.svg` (admin home) | `images/logo.svg` |
| `/admin/images/home-bg.png` (CSS) | `images/home-bg.png` |
| `../images/login-img.png` (admin signin / forgot / reset) | `images/login-img.png` |
| `/images/logo/favicon.ico` (profile fallback) | `images/logo/favicon.ico` |
| `/images/logo/logo.svg` | `images/logo/logo.svg` |
| `/images/logo/logo-icon.svg` | `images/logo/logo-icon.svg` |
| `/images/logo/auth-logo.svg` | `images/logo/auth-logo.svg` |

### Additional template / demo image refs in frozen admin source

```
images/country/country-01.svg
images/country/country-02.svg
images/error/404.svg
images/error/404-dark.svg
images/grid-image/image-01.png
images/grid-image/image-02.png
images/grid-image/image-03.png
images/grid-image/image-04.png
images/grid-image/image-05.png
images/grid-image/image-06.png
images/product/product-01.jpg
images/product/product-02.jpg
images/product/product-03.jpg
images/product/product-04.jpg
images/product/product-05.jpg
images/shape/grid-01.svg
images/task/signin.png
images/user/user-01.jpg
images/user/user-02.jpg
images/user/user-03.jpg
images/user/user-04.jpg
images/user/user-05.jpg
images/user/user-17.jpg
images/user/user-18.jpg
images/user/user-20.jpg
images/user/user-21.jpg
images/user/user-22.jpg
images/user/user-23.jpg
images/user/user-24.jpg
images/user/user-25.jpg
images/user/user-26.jpg
images/user/user-27.jpg
images/user/user-28.jpg
images/user/user-29.jpg
images/user/user-30.jpg
images/user/user-31.jpg
images/user/user-32.jpg
images/user/user-33.jpg
```

Please supply the original TaxSimba / Toxel admin `public/` tree so these can be restored on a follow-up correction commit without inventing artwork.
