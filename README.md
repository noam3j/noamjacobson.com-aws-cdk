# noamjacobson.com

This is the CDK project that builds the resources to host the noamjacobson.com website.

## Setup notes

I followed https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html and https://dev.to/ryands17/deploying-a-spa-using-aws-cdk-typescript-4ibf to set up this code.

I also had to enable OAuth between AWS and Github. I had to do that from the Codebuild UI

## Instructions

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
