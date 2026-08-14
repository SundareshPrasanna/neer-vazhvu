# review-candidates/

Anomaly-review candidates written by scheduled producers when a refresh
deviates beyond its delta threshold. NOT under public/ (nothing here is
served, catalogued, or gated) and NOT canonical data.

Acceptance: review the candidate PR, then move the file over its canonical
path (the NVDM envelope was inherited at write time). Note plain `mv` +
`git add -A` - `git mv` refuses to overwrite a tracked destination without -f:

    mv review-candidates/pallikaranai-overture-buildings.candidate.json \
       public/data/rich-bodies/pallikaranai-overture-buildings.json
    git add -A

then regenerate governance outputs (catalogue + conformance) in the same
commit. Rejection: delete the file and close the PR.
