import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnParametersCode, Code } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class GenieServiceStack extends cdk.Stack {
  public readonly genieService: FargateService;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // const serviceAsset = new DockerImageAsset(this, "GenieServiceAsset", {
    //   directory: "./app",
    //   file: "dockerfile"
    // })

    const vpc = new Vpc(this, "GenieServiceVPC", {
      cidr: "10.1.0.0/16",
      natGateways: 1,
      subnetConfiguration: [
        {  cidrMask: 24, subnetType: SubnetType.PUBLIC, name: "Public" },
        {  cidrMask: 24, subnetType: SubnetType.PRIVATE_WITH_EGRESS, name: "Private" }
        ],
      maxAzs: 3 // Default is all AZs in region
    });

    const repository = new Repository(this, "genie-service", {
      repositoryName: "genie-service"
    });


    const cluster = new Cluster(this, "GenieServiceCluster", {
      vpc: vpc
    });

    const executionRolePolicy =  new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ]
    });
    
    const fargateTaskDefinition = new FargateTaskDefinition(this, 'GenieServiceTaskDefinition', {
      memoryLimitMiB: 4096,
      cpu: 512
      ,
    });
    fargateTaskDefinition.addToExecutionRolePolicy(executionRolePolicy);
    // fargateTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   resources: [table.tableArn],
    //   actions: ['dynamodb:*']
    // }));
    
    const container = fargateTaskDefinition.addContainer("genie-service", {
      // Use an image from Amazon ECR
      image: ContainerImage.fromRegistry(repository.repositoryUri),
      logging: LogDrivers.awsLogs({streamPrefix: 'genie-service'}),
      environment: { 
        // 'DYNAMODB_MESSAGES_TABLE': table.tableName,
        'APP_ID' : 'genie-service'
      },
      
      // ... other options here ...
    });
    
    container.addPortMappings({
      containerPort: 3000
    });


    const sg_service = new SecurityGroup(this, 'MySGGenieService', { vpc: vpc });
    sg_service.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(3000));
    
    this.genieService = new FargateService(this, 'GenieFargateService', {
      cluster,
      taskDefinition: fargateTaskDefinition,
      desiredCount: 2,
      assignPublicIp: false,
      securityGroups: [sg_service]
    });
    
    // Setup AutoScaling policy
    const scaling = this.genieService.autoScaleTaskCount({ maxCapacity: 6, minCapacity: 2 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)
    });


    const lb = new ApplicationLoadBalancer(this, 'GenieServiceALB', {
      vpc,
      internetFacing: true,
      
    });

    

    const listener = lb.addListener('Listener', {
      port: 80,
    });

    listener.addTargets('Target', {
      port: 80,
      targets: [this.genieService],
      healthCheck: { 
        path: '/health_check',
        // interval: Duration.seconds(120) 
      }
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');


  }
}
