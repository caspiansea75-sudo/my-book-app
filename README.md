# My Project

This is a full-stack app that needs a Postgres database to run.

## Deploying (free)

1. **Database**: Create a free project at [neon.tech](https://neon.tech) and copy the connection string it gives you.
2. **Hosting**: Push this folder to a new GitHub repository, then import it at [vercel.com/new](https://vercel.com/new).
3. **Environment variable**: In the Vercel project settings, add:
   - `DATABASE_URL` = the connection string from Neon
4. Click **Deploy**. Vercel will build the project and give you a live `.vercel.app` link.

That's it — the site will auto-redeploy any time you push new changes to GitHub.
