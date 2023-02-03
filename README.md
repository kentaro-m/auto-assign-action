# Auto Assign Action

An action which adds reviewers to the pull request when the pull request is opened.

## :arrow_forward: Usage

Create a workflow (e.g. `.github/workflows/action.yml` For more detail, refer to [Configuring a workflow](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) for running the auto-assign action.

```yml
name: auto-assign
on:
  pull_request:
    types: [opened, ready_for_review]

jobs:
  add-reviewser:
    runs-on: ubuntu-latest
    steps:
      - uses: chronograph-pe/auto-assign-action@master
        with:
          github_token: ${{ secrets.ACTIONS_TOKEN }} # Must include pull_request:write and members:read permissions
          teams: team1,team2,team3
```

## :memo: Licence

MIT
