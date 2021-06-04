# Auto Assign Action
An action which adds reviewers to the pull request when the pull request is opened.

**Update 02-06-2021**

Appfactory does have a part of this action in a secret var for easier maintenance (one location to update).

The content of this secret can be found in the file auto_assign.example.

The secret can be found in:
Organization Account: KPN Appfactory
Account setting -> Secrets -> REVIEWER_LIST

To change the list just update the secret contents with the updates contents of auto_assign.example.

## :arrow_forward: Usage
Create a workflow (e.g. `.github/workflows/action.yml` For more detail, refer to [Configuring a workflow](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) for running the auto-assign action.

```yml
name: 'Auto Assign'
on: pull_request

jobs:
  add-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: kentaro-m/auto-assign-action@v1.1.2
        with:
          configuration-path: ".github/some_name_for_configs.yml" # Only needed if you use something other than .github/auto_assign.yml
          configuration: ${{ secrets.REVIEWER_CONFIG }} # Only needed if you want to provide (parts of the) configuration in a variable instead of a file.
```

Create a separate configuration file for the auto-assign action (e.g. `.github/auto_assign.yml`).

### Single Reviewers List
Add reviewers/assignees to the pull request based on single reviewers list.

```yaml
# Set to true to add reviewers to pull requests
addReviewers: true

# Set to true to add assignees to pull requests
addAssignees: false

# A list of reviewers to be added to pull requests (GitHub user name)
reviewers:
  - reviewerA
  - reviewerB
  - reviewerC

# A number of reviewers added to the pull request
# Set 0 to add all the reviewers (default: 0)
numberOfReviewers: 0

# A list of assignees, overrides reviewers if set
# assignees:
#   - assigneeA

# A number of assignees to add to the pull request
# Set to 0 to add all of the assignees.
# Uses numberOfReviewers if unset.
# numberOfAssignees: 2

# A list of keywords to be skipped the process that add reviewers if pull requests include it
# skipKeywords:
#   - wip
```

### Multiple Reviewers List
Add reviewers/assignees to the pull request based on multiple reviewers list.

If you and peers work at the separate office or they work at the separate team by roles like frontend and backend, you might be good to use adding reviewers from each group.

```yaml
# Set to true to add reviewers to pull requests
addReviewers: true

# Set to true to add assignees to pull requests
addAssignees: false

# A number of reviewers added to the pull request
# Set 0 to add all the reviewers (default: 0)
numberOfReviewers: 1

# A number of assignees to add to the pull request
# Set to 0 to add all of the assignees.
# Uses numberOfReviewers if unset.
# numberOfAssignees: 2

# Set to true to add reviewers from different groups to pull requests
useReviewGroups: true

# A list of reviewers, split into different groups, to be added to pull requests (GitHub user name)
reviewGroups:
  groupA:
    - reviewerA
    - reviewerB
    - reviewerC
  groupB:
    - reviewerD
    - reviewerE
    - reviewerF

# Set to true to add assignees from different groups to pull requests
useAssigneeGroups: false

# A list of assignees, split into different froups, to be added to pull requests (GitHub user name)
# assigneeGroups:
#   groupA:
#     - assigneeA
#     - assigneeB
#     - assigneeC
#   groupB:
#     - assigneeD
#     - assigneeE
#     - assigneeF

# A list of keywords to be skipped the process that add reviewers if pull requests include it
# skipKeywords:
#   - wip
```

### Assign Author as Assignee
Add the PR creator as the assignee of the pull request.

```yaml
# Set addAssignees to 'author' to set the PR creator as the assignee.
addAssignees: author
```

### Filter by label
The action will only run if the PR meets the specified filters

```yaml
filterLabels:
  # Run
  include:
    - my_label
    - another_label
  # Not run
  exclude:
    - wip

```

### Configuration in a variable
If you want to use a list of reviewers from a secret or from an output of a previous action you can use the configuration input to pass configuration data in yaml format. The variables and data that can be passed are exactly the same as those in the config file, and will overwrite the variables that are defined in config data if they overlap.

## :memo: Licence
MIT
