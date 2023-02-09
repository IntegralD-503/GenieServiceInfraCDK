import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { PipelineProject, LinuxBuildImage, BuildSpec } from "aws-cdk-lib/aws-codebuild";
import { Artifact, IStage, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, EcsDeployAction, GitHubSourceAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { GenieServiceStack } from "../lib/genie_service-stack";

export class PipelineStack extends Stack {
    private readonly pipeline: Pipeline;
    private readonly cdkBuildOutput: Artifact;
    private readonly genieServiceSourceOutput: Artifact;
    private readonly genieServiceBuildOutput: Artifact;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);


        this.pipeline = new Pipeline(this, 'GenieServicePipeline', {
            pipelineName: 'GenieServicePipeline',
            crossAccountKeys: false,
            restartExecutionOnUpdate: true
          });
      
          const cdkSourceOutput = new Artifact('GenieServiceCDKOutput');
          this.genieServiceSourceOutput = new Artifact('GenieServiceSourceOutput');
      
          this.pipeline.addStage({
            stageName:'Source',
            actions:[
              new GitHubSourceAction({
                owner: 'IntegralD-503',
                repo: 'GenieServiceInfraCDK',
                branch: 'master',
                actionName: 'GenieServicePipeline_Source',
                oauthToken: SecretValue.secretsManager('github-token'),
                output: cdkSourceOutput
              }),
              new GitHubSourceAction({
                owner: 'IntegralD-503',
                repo: 'GenieService',
                branch: 'master',
                actionName: 'GenieService_Source',
                oauthToken: SecretValue.secretsManager('github-token'),
                output: this.genieServiceSourceOutput
              })
            ]
          });

          

          this.cdkBuildOutput = new Artifact("CdkBuildOutput");
          this.genieServiceBuildOutput = new Artifact("GenieServiceBuildOutput");
    
          const codeBuildECRTokenAccess = new PolicyDocument({
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ['*'],
                actions: [
                          "ecr:GetAuthorizationToken",
                      ]
              })
            ]
          });

          const codeBuildECRTokenAccessRole = new Role(this, "GenieServiceBuildActionECRRole", {
            assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
            inlinePolicies: {
             CodeBuildECRTokenAccess: codeBuildECRTokenAccess
            }
          })

          this.pipeline.addStage({
            stageName: 'Build',
            actions: [
              new CodeBuildAction({
                actionName: 'CDK_Build',
                input: cdkSourceOutput,
                outputs: [ this.cdkBuildOutput ],
                project: new PipelineProject(this, 'CdkBuildProject', {
                  environment: {
                    buildImage: LinuxBuildImage.AMAZON_LINUX_2_4
                  },
                  buildSpec: BuildSpec.fromSourceFilename('build-specs/cdk-build-spec.yml')
                })
              }),
              new CodeBuildAction({
                actionName: 'GenieService_Build',
                input: this.genieServiceSourceOutput,
                outputs: [ this.genieServiceBuildOutput ],
                project: new PipelineProject(this, 'GenieServiceBuildProject', {
                  environment: {
                    buildImage: LinuxBuildImage.AMAZON_LINUX_2_4
                  },
                  buildSpec: BuildSpec.fromSourceFilename('build-specs/genie-service-build-spec.yml')
                }),
                role: codeBuildECRTokenAccessRole
              })
            ]
          });

          this.pipeline.addStage({
            stageName: 'Pipeline_Update',
            actions: [
              new CloudFormationCreateUpdateStackAction({
                actionName: 'GenieServicePipeline_Update',
                stackName: 'GenieServicePipelineStack',
                templatePath: this.cdkBuildOutput.atPath('GenieServiceStack.template.json'),
                adminPermissions: true,
              })
            ]
          });
    }

    public addGenieServiceStage(genieStack: GenieServiceStack, stageName: string): IStage {
      return this.pipeline.addStage({
        stageName: stageName,
        actions: [
          new EcsDeployAction({
            actionName: 'GenieServiceECS_Update',
            service: genieStack.genieService,
            input: this.genieServiceBuildOutput
          }),
        ]
      })
    }
}