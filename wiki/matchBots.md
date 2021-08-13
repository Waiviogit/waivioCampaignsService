send operation with custom_json

###1)Set bot
id: "matchBotSet"

json:
```js
{
  "type" - required, enum [ author, curator], string
  "name" - required, string
  "enabled" - required, boolean
  "voteRatio" - if type === curator required, number min 0.01, max 10
  "voteWeight" - if type === author required, number min 1, max 10000
  "minVotingPower" - min voting power required, number min 1, max 10000
  "note" - optional, string
  "enablePowerDown" - optional, boolean
  "expiredAt" - optional, date, 
  "voteComments" - optional, boolean on curators bot
}
```
###2)Unset bot
id: "matchBotUnset"

json:
```js
{
  "type" - required, enum [ author, curator], string
  "name" - required, string
}
```
