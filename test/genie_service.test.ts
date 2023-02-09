import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as GenieService from '../lib/genie_service-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/genie_service-stack.ts
test('Genie Service Stack Created', () => {
  const app = new cdk.App();
    // WHEN
  const stack = new GenieService.GenieServiceStack(app, 'MyTestStack');
    // THEN
  const template = Template.fromStack(stack);

//   template.hasResourceProperties('AWS::ECR::Repository', {
//   });

  expect(template).toMatchSnapshot();
});
