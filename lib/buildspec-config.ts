export function getBuildSpecConfig(bucketName: string, cloudfrontId: string) {
  return {
    version: '0.2',
    phases: {
      install: {
        commands: ['echo Doing install step...'],
      },
      build: {
        commands: [
          'echo Doing build step...',
          `aws s3 sync . s3://${bucketName} --exclude "*.js.map" --delete`,
          `aws cloudfront create-invalidation --distribution-id ${cloudfrontId} --paths "/index.html"`,
        ],
      },
    },
  };
}
