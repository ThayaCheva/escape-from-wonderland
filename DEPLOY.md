# Putting Escape from Wonderland online

This puts the game on a free [Render](https://render.com) server so friends can join from their own PCs.
You need a GitHub account. It takes about 10 minutes, once.

## 1. Put the project on GitHub

1. Go to <https://github.com/new>.
2. Name the repository (for example `escape-from-wonderland`). Leave it empty: no README, no .gitignore.
3. Click **Create repository**. Keep the page open; it shows the repository's URL.
4. In a terminal in this project folder, run (replace the URL with yours):

   ```bash
   git remote add origin https://github.com/YOUR-NAME/escape-from-wonderland.git
   git push -u origin HEAD:main
   ```

   Git may ask you to sign in to GitHub the first time.

## 2. Create the server on Render

1. Go to <https://render.com> and click **Get Started**. Choose **GitHub** to sign up with your GitHub account.
   No credit card is needed.
2. In the Render dashboard click **New +** → **Blueprint**.
3. Connect your GitHub account if asked, and pick the `escape-from-wonderland` repository.
4. Render reads `render.yaml` from the project and shows one free web service. Click **Apply**.
5. Wait until the service says **Live** (the first build takes a few minutes).
6. Click the service. Its address looks like `https://escape-from-wonderland-sg.onrender.com`.
   That is your game. Open it, click **Create online room**, and paste the link into Discord.

## Good to know

- **The first visit of the night is slow.** The free server sleeps after about 15 minutes with
  nobody playing. The first person to open the link waits about a minute while it wakes up.
  After that it's quick. An open game keeps it awake.
- **A server restart ends games in progress.** Games live in the server's memory. If Render
  restarts the server (rare, usually only when you push an update), start a new room.
- **Updating the game:** push new commits to `main` on GitHub (`git push origin HEAD:main`).
  Render rebuilds and redeploys automatically.
- **One-screen mode still works** from the same link: choose **Play on one screen** on the title screen.

## Running it on your own computer

```bash
npm install
npm run build
npm start          # then open http://localhost:8080
```

For development with live reload of the one-screen mode, `npm run dev` still works.
