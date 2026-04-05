#!/bin/bash
set -e

echo "Running Prisma Generate..."
npx prisma generate

echo "Running Prisma Migrate Deploy..."
npx prisma migrate deploy

echo "Building TypeScript..."
npx tsc

echo "Build completed!"
