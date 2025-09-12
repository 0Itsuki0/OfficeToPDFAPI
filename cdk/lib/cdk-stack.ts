import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path'
import { EndpointType, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway'
import { Duration } from "aws-cdk-lib"
import { DockerImageCode, DockerImageFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const apigatewayLambda = new DockerImageFunction(this, "OfficeToPDFLambda", {
            // directory containing Dockerfile
            code: DockerImageCode.fromImageAsset(join(__dirname, '..', '..', 'lambda'), {
                // required for MacOS.
                // Otherwise, we will get Error: fork/exec /opt/extensions/lambda-adapter: exec format error Extension.LaunchError when launching Lmabda
                platform: Platform.LINUX_AMD64
            }),
            timeout: Duration.minutes(5),
            memorySize: 10240
        });

        const restApi = new LambdaRestApi(this, 'OfficeToPDFAPIGateway', {
            handler: apigatewayLambda,
            endpointTypes: [EndpointType.REGIONAL],
            // required for both accept binary and sending binary
            binaryMediaTypes: ["application/*"],
        })
    }
}
