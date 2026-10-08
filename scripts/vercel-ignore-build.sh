#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips the
# build, exit 1 builds. Branch pushes never build unless the commit subject
# carries [preview]. Production builds only when something outside the data
# corpus and docs changed since the last successful deployment; Vercel's
# checkout is shallow, so that commit is fetched by hash first and a failed
# fetch still builds.
if [ "$VERCEL_ENV" != "production" ]; then
  printf '%s\n' "$VERCEL_GIT_COMMIT_MESSAGE" | head -n 1 | grep -qF '[preview]' && exit 1
  exit 0
fi
[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] || exit 1
git fetch -q --depth=1 "https://github.com/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG.git" "$VERCEL_GIT_PREVIOUS_SHA" || exit 1
git diff --quiet FETCH_HEAD HEAD -- . ':(exclude)public/data' ':(exclude)public/geojson' ':(exclude)docs' || exit 1
exit 0
