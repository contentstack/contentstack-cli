[![Contentstack](https://www.contentstack.com/docs/static/images/contentstack.png)](https://www.contentstack.com/)

# Contentstack command line interface(cli).

## Installation

**Note**: This version of Contentstack CLI can be used only for v3 stacks. Use cli v1.x, for v2 stacks.


Run the following command in a Terminal or Command Prompt to globally install the latest version of Contentstack CLI on your system:

```bash
$ npm install -g contentstack-cli
```
*You might need administrator privileges to perform this installation.*

## Commands in CLI

Contentstack CLI comes with handy commands which helps to achieve the support work for the contentstack-express like publishing, unpublishing, synchronizing the data, connecting existing stacks etc.

```bash

	     **
	   ***
	 ****
	***** **
	 ****  ***             Contentstack!
	   ***  ****
	     ** *****
	        ****
	       ***
	      **

Note: This version of Contentstack CLI can be used only for V3 stacks. Use CLI version 1.x, for V2 stacks.

Contentstack Command Line Interface 3.0.0

Usage: contentstack [command]

Commands:
    connect            Connect to an existing stack in Contentstack
    sync               Synchronize all the published content locally
    publish            Publish content-types/assets/both on specified environment
    unpublish          Unpublish content-types/assets/both on specified environment
    plugin create      Create the new plugin in the current application

Options:
    -h, --help     output usage information
    -V, --version  output the version number

Documentation can be found at https://contentstackdocs.built.io/
```
### Connect
The connect command is used to connect to a existing stack. Navigate to a location on your computer and create a site development folder using the following command.
```bash
$ contentstack connect
```
You'll be guided through a step-by-step procedure to create the directory where the stack's files will be kept.

### Publish

The publish command is used to publish the content to the specified environment.

```
$ contentstack publish
```
You'll be guided through a step-by-step procedure to publish content of the stack.

### Unpublish

The unpublish command is used to unpublish the content from the specified environment.

```
$ contentstack unpublish
```
You'll be guided through a step-by-step procedure to unpublish content of the stack.

### Sync

The sync command is used to synchronize all the published content on your web application.

```
$ contentstack sync
```
You'll be guided through a step-by-step procedure to synchronize all the content of the stack.

### Plugin

The 'plugin create' command creates the plugin with the basic structure.

```
$ contentstack plugin create YOUR_PLUGIN_NAME
```
Once the plugin is created, you can activate it in config/all.js file.

## Links
 - [Website](https://www.contentstack.com/)
 - [Official Documentation](https://www.contentstack.com/docs/)

### License
Copyright © 2018 [Contentstack](https://www.contentstack.com/). All Rights Reserved.
