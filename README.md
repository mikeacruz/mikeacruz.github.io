# michaelacruz.com

Personal blog and website built with Jekyll and hosted on GitHub Pages.

## Quick Start - Publishing

To publish your blog:

1. **Write your post** in `_posts/` directory with the format: `YYYY-MM-DD-post-title.md`
2. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add new post: [post title]"
   ```
3. **Push to GitHub:**
   ```bash
   git push origin main
   ```
4. **GitHub Pages automatically builds and deploys** your site within a few minutes
5. Your site will be live at: https://michaelacruz.com

## Local Development

To preview your site locally before publishing:

1. **Install dependencies:**
   ```bash
   bundle install
   ```

2. **Run Jekyll server:**
   ```bash
   bundle exec jekyll serve
   ```

3. **View your site** at: http://localhost:4000

## Writing New Posts

1. Create a new file in `_posts/` directory
2. Use the naming format: `YYYY-MM-DD-post-title.md`
3. Add front matter at the top:
   ```yaml
   ---
   layout: post
   title: "Your Post Title"
   date: YYYY-MM-DD HH:MM:SS -0000
   ---
   ```
4. Write your content in Markdown below the front matter

## Project Structure

- `_posts/` - Blog posts (Markdown files)
- `_layouts/` - HTML templates
- `_config.yml` - Jekyll configuration
- `index.html` - Homepage
- `blog/index.html` - Blog listing page
- `CNAME` - Custom domain configuration
- `assets/css/` - Stylesheets

## Custom Domain

The site uses a custom domain `michaelacruz.com` configured via the `CNAME` file. GitHub Pages automatically handles DNS when this file is present.

## Plugins

- `jekyll-feed` - Generates RSS feed
- `jekyll-sitemap` - Generates sitemap.xml

## Notes

- GitHub Pages builds automatically on push to `main` branch
- Builds typically take 1-2 minutes
- Check build status in your repository's "Actions" tab on GitHub
- The site uses plain CSS (not SCSS) as configured in `_config.yml`
