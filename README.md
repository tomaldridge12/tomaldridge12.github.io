# Tom Aldridge — personal site

A static, GitHub Pages-ready personal CV/showcase with a custom WebGL2 hero field and responsive CSS/HTML fallbacks.

## Run locally

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

## Deploy to GitHub Pages

Push the repository to GitHub, then choose **Settings → Pages → Deploy from a branch**, select the default branch, and use the repository root (`/`) as the folder. No build step is required.

The page uses relative asset paths, so it also works when served from a project subpath. WebGL2 enhances the hero visual; the page remains usable if WebGL2 or motion is unavailable.

Contact links are already configured in `index.html` for email, GitHub, and LinkedIn.
