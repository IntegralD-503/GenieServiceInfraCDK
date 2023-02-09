import { Stack, StackProps } from "aws-cdk-lib";
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class IamStack extends Stack {

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new ManagedPolicy(this, 'codeBuildECRTokenAccessPolicy', {
            statements: [
                new PolicyStatement({
                  effect: Effect.ALLOW,
                  resources: ['*'],
                  actions: [
                            "ecr:GetAuthorizationToken",
                        ]
                })
              ]
        })
        
    
        // const codeBuildECRTokenAccessRole = new Role(this, "GenieServiceBuildActionECRRole", {
        //     assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
        //     inlinePolicies: {
        //      CodeBuildECRTokenAccess: codeBuildECRTokenAccess
        //     }
        //   })
    
    
    }
}