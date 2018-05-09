#!/usr/bin/env bash

TAG=$(node ./bin/print-version.js)

git tag $TAG

git push origin $TAG
