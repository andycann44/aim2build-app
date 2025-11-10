# Deployment Guide for LEGO Brick Scanner

This guide explains how to deploy the LEGO Brick Scanner app to various hosting platforms.

## Prerequisites

- Git installed on your system
- A hosting account (GitHub Pages, Netlify, Vercel, etc.)
- Basic knowledge of command line

## Option 1: GitHub Pages (Recommended for this project)

GitHub Pages is free and ideal for static web apps.

### Steps:

1. **Push code to GitHub** (already done if you're reading this!)

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click on "Settings"
   - Scroll down to "Pages" section
   - Under "Source", select the branch (e.g., `main` or `copilot/add-lego-brick-scanner`)
   - Select `/root` as the folder
   - Click "Save"

3. **Wait for deployment** (usually 1-2 minutes)

4. **Access your app:**
   - Your app will be available at: `https://andycann44.github.io/aim2build-app/`

### Important Notes for GitHub Pages:

- HTTPS is automatically enabled (required for camera access)
- Service worker will work properly
- All features should function as expected

## Option 2: Netlify

Netlify offers easy deployment with continuous deployment from Git.

### Steps:

1. **Sign up for Netlify** at https://netlify.com

2. **Connect your repository:**
   - Click "New site from Git"
   - Choose GitHub and authorize Netlify
   - Select your repository
   - Configure build settings:
     - Build command: (leave empty)
     - Publish directory: `/`
   - Click "Deploy site"

3. **Custom domain (optional):**
   - Go to "Domain settings"
   - Add your custom domain
   - Update DNS records as instructed

### Netlify Features:
- Automatic HTTPS
- Continuous deployment on git push
- Form handling (if you add contact forms later)
- Serverless functions (for future enhancements)

## Option 3: Vercel

Similar to Netlify, optimized for frontend frameworks.

### Steps:

1. **Sign up for Vercel** at https://vercel.com

2. **Import project:**
   - Click "New Project"
   - Import from GitHub
   - Select your repository
   - Leave all settings as default
   - Click "Deploy"

3. **Access your app:**
   - Vercel provides a URL like: `aim2build-app.vercel.app`
   - Custom domains can be added in settings

## Option 4: Traditional Web Hosting

For cPanel, shared hosting, or VPS.

### Steps:

1. **Download or clone the repository:**
   ```bash
   git clone https://github.com/andycann44/aim2build-app.git
   ```

2. **Upload files to your web server:**
   - Use FTP/SFTP or file manager
   - Upload all files to your public_html or www directory
   - Maintain the file structure

3. **Ensure HTTPS is enabled:**
   - Install SSL certificate (Let's Encrypt is free)
   - HTTPS is required for camera access
   - Configure redirect from HTTP to HTTPS

4. **Test the deployment:**
   - Visit your domain
   - Grant camera permissions
   - Test scanning functionality

## Option 5: Self-Hosted (Docker)

For complete control, you can use Docker.

### Create a Dockerfile:

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

### Build and run:

```bash
# Build the image
docker build -t lego-scanner .

# Run the container
docker run -d -p 8080:80 lego-scanner
```

### Access:
- Local: http://localhost:8080
- For HTTPS, use a reverse proxy like Nginx or Traefik

## Post-Deployment Checklist

After deploying to any platform:

- [ ] Verify HTTPS is working (required for camera)
- [ ] Test camera access on mobile device
- [ ] Confirm TensorFlow.js loads correctly
- [ ] Test scanning a LEGO brick
- [ ] Verify inventory persistence
- [ ] Check PWA installation works
- [ ] Test on different devices/browsers
- [ ] Monitor for any console errors

## Troubleshooting

### Camera Not Working

**Problem:** "Camera access denied" error

**Solutions:**
1. Ensure site is served over HTTPS (not HTTP)
2. Check browser permissions for the site
3. Try a different browser
4. On iOS, ensure it's Safari (or add to home screen)

### TensorFlow.js Not Loading

**Problem:** Model fails to load

**Solutions:**
1. Check internet connection (needed for CDN)
2. Verify CDN links in index.html are accessible
3. Check browser console for specific errors
4. Try clearing browser cache

### Service Worker Issues

**Problem:** PWA features not working

**Solutions:**
1. HTTPS is required for service workers
2. Check browser console for SW registration errors
3. Hard refresh (Ctrl+Shift+R) to update SW
4. Verify service-worker.js is accessible

### Icons Not Displaying

**Problem:** PWA icons don't show

**Solutions:**
1. Clear browser cache
2. Verify icon files are accessible
3. Check manifest.json paths
4. Re-add to home screen

## Performance Optimization

For production deployments:

1. **Enable Compression:**
   - Use gzip or brotli compression on server
   - Most hosting platforms enable this by default

2. **Cache Static Assets:**
   - Configure proper cache headers
   - Service worker already handles caching

3. **CDN (optional):**
   - Use a CDN for TensorFlow.js if self-hosting
   - Consider hosting icons on CDN

4. **Minification (optional):**
   - Minify CSS and JavaScript for smaller file sizes
   - Tools: terser (JS), cssnano (CSS)

## Monitoring & Analytics

Consider adding:

1. **Google Analytics** for usage tracking
2. **Error tracking** (Sentry, Rollbar)
3. **Performance monitoring** (Lighthouse CI)

## Security Considerations

- ✅ No sensitive data stored on server
- ✅ All data stored locally in browser
- ✅ HTTPS enforced for camera access
- ✅ No external API keys exposed
- ✅ Content Security Policy can be added

## Updates & Maintenance

To update the app:

1. Make changes to code
2. Commit and push to GitHub
3. Hosting platforms with continuous deployment will auto-update
4. For manual hosting, re-upload changed files
5. Users will get updates when they refresh (or via service worker)

## Custom Domain Setup

### For GitHub Pages:

1. Add CNAME file with your domain:
   ```bash
   echo "yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. Update DNS records:
   - Add A records pointing to GitHub Pages IPs
   - Or add CNAME record pointing to `yourusername.github.io`

3. Enable HTTPS in GitHub Pages settings

### For Netlify/Vercel:

1. Add domain in platform settings
2. Follow DNS configuration instructions
3. HTTPS is automatically configured

## Scaling Considerations

Current app is lightweight and scales well:
- Static files only
- No backend required
- All processing client-side
- No database connections

Expected capacity:
- Can handle unlimited concurrent users
- Limited only by hosting bandwidth
- No server-side processing needed

## Cost Estimates

- **GitHub Pages:** Free for public repositories
- **Netlify Free Tier:** 100GB bandwidth/month
- **Vercel Free Tier:** 100GB bandwidth/month  
- **Traditional Hosting:** $5-20/month (shared hosting)
- **VPS/Cloud:** $5-50+/month (full control)

## Support

For deployment issues:
- Check platform-specific documentation
- Review browser console errors
- Test in incognito/private mode
- Try different browsers/devices

## Next Steps After Deployment

1. Share the URL with users
2. Gather feedback on accuracy
3. Add more LEGO parts to database
4. Consider training a custom model
5. Add additional features from roadmap

---

**Note:** Remember that camera access requires HTTPS. If deploying to a custom domain, ensure SSL certificate is properly configured.
