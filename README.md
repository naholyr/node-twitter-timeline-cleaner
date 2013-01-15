# Twitter Timeline Cleaner

This tool will grab your Twitter data and provide you some statistics to help you decide who is important, and who you could unfollow to reduce your timeline.

## Current status

* Current development is focused on stats calculation
* Next important step is to provide automatic advice about who you could unfollow
* Then, the tool should be enhanced to allow unfollowing directly from CLI
* Last step should be to help you move some contacts to lists, a way to reduce your timeline but still not lose contacts that you could find useful for a specific topic

## Installation

`npm install -g twitter-timeline-cleaner`

## Usage

The module will install an executable command called `ttc`:

```
$ ttc --help

  Usage: ttc [ttc_options] <command> [command_options]

  Commands:

    help                   Help for specified command
    stats [options]        Show statistics about your timeline
    status                 Show app's status (i.e. rate limit)
    keys [options]         Update app's credentials to use your own (browse https://dev.twitter.com/apps/new to create it)
    test                   Test connection to Twitter
    cache [options]        Manage your local cache

  Options:

    -h, --help       output usage information
    -V, --version    output the version number
    --config <file>  Custom configuration file
    --no-cache       Disable cache
```

### help

Command `help` will provide verbose help about a given command.

For each command, you should always run `ttc help command` before asking for more help :)

### status

Command `status` will provide current rate limits and some related information.

### keys

This command will allow you to update credentials configuration.

Check "security" part lower about this particular command.

### test

Will test connection with Twitter. This is especially useful if you think your credentials are broken.

### cache

If you think your current local data is corrupted, or too heavy (should be around 1 to 3 Mb), you can manage it using this command.

You will be able to view current cache statistics (keys & size), remove a specific key, or reset the whole cache.

### stats

This is the main command, it will:

* Fetch lot of data from your Twitter account: friends, timelines, direct messages…
* Cache it locally for latter use (the cache **does not** include messages texts, as they're not useful, and for obvious privacy reasons)
* Calculate some stats on this bunch of bytes, and provide you some useful tables

The goal is of course to help you decide who you can unfollow, and who you should not.

Sample output:

```
$ ttc stats
Connecting to Twitter…

@naholyr (#35705169) following 295 account(s)

  I will now read your timeline and your direct messages, and then be able
  to tell you who you could remove to improve your productivity :)
  Note: fetched data will be cached locally
        for privacy reasons that DOES NOT include texts of messages
        if you do not want to cache DMs, add option "--no-cache-dms"

Extracting Friends List          [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Total 295 friend(s)

Extracting Direct Messages       [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Fetched 540 new post(s), Total 540 post(s)

Extracting Direct Messages Sent  [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Fetched 509 new post(s), Total 509 post(s)

Extracting Home Timeline         [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Fetched 771 new post(s), Total 771 post(s)

Extracting User Timeline         [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Fetched 1073 new post(s), Total 1073 post(s)

Extracting Mentions              [⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅] 100%
  Fetched 831 new post(s), Total 831 post(s)


Note: at this point, all data (except direct messages unless you
      provided options "--cache-dms") is cached.
      You can run "stats --offline" to return directly to this screen

Analyzing data…

  Ready!
  Remember that this data is only a fraction of your real activity
  For example, data is based on only 771 messages from your timeline


What do you want to do with your data?
  1) Global statistics
  2) Let me tell you who you should unfollow!
  3) Who is filling your timeline?
  4) Who is inactive?
  5) Who do you really care?
  6) Quit
  : 1



Global statistics:

  You receive ~ 623 messages daily, do you feel overwhelmed?
  You post ~ 21 messages daily
  You receive ~ 24 mentions daily
  The 20% top posters in your timeline produce 79% of total
  Amongst your 295 friends, 55% did not post any message during the last 30 hours.
```

## Files

### Configuration

OAuth access tokens, and app's credentials, are stored in `$HOME/.ttc.json`.

If app is unable to guess what you `$HOME` directory is, it should fail.

You can use option `--config` to provide a custom configuration file's path.

Example: `ttc --config=/path/to/my-config.json test`

### Cache

Fetched data is cached in a local file, stored in `$HOME/.ttc.cache`.

If this file cannot be read or written, you should see error messages related to this.

You can use option `--no-cache` to disable cache.

Note that each time you run `ttc stats`, new posts are **appended** to cache, which means that you will have more and more precise statistics as soon as you don't delete your cache, and run `ttc stats` often enough. Default limits are Twitter's: 800 messages max.

## Security

Twitter's OAuth credentials suck: if I need to access your DMs, I must claim "read & write" permissions :(

The Twitter application **does not** write anything, but it does not mean it's safe!

As they're hardcoded, **anyone could use app's key & secret** and then write an application impersonating mine, which you will have authorized to access your data. This is a huge security flaw, so you're **highly advised to manage your credentials**.

There are two solutions to be really safe:

* Go to https://twitter.com/settings/applications and remove "Timeline Cleaner" application as soon as you've finished using it. You'll be asked to authenticate next time again, but at least you cannot be fooled without noticing it.
 * This is the simpliest solution, perfect if you're not using `ttc` regularly
* Create your own application from https://dev.twitter.com/apps/new
 * Fill name (must not exist, append your screen_name to make it simple) and description (10 chars min) with whatever you want
 * URL does not have to really exist
 * Ignore other fields
 * Once created, go to "Settings", then in "Application type" check "Read, Write and Access direct messages"
 * In "Details" you can get "Consumer key" and "Consumer secret", use them to run `ttc keys --key=consumer_key --secret=consumer_secret`
 * From now, `ttc` will use your personal app, that noone can impersonate, and you're really safe
