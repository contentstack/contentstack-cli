[![Contentstack](https://www.contentstack.com/docs/static/images/contentstack.png)](https://www.contentstack.com/)

**Note**: The contentstack-express command-line utility will soon be deprecated. We recommend you to check out our latest [CLI documentation](https://www.contentstack.com/docs/developers/cli) for performing content management activities.

# contentstack-express Command-line Utility

## Installation

**Note**: This version of command-line utility can be used only for v3 stacks. Use command-line utility v1.x, for v2 stacks.


Run the following command in terminal or command prompt to globally install the latest version of contentstack-express command-line utility on your system:

```bash
$ npm install -g contentstack-cli
```
*You might need administrator privileges to perform this installation.*

## Commands in contentstack-express command-line utility

The contentstack-express command-line utility offers a useful set of commands to help you achieve the support work for contentstack-express such as publishing, unpublishing, synchronizing the data, connecting existing stacks, and so on.

Note: These commands are specific to only contentstack-express command-line utility.

```bash

 	     **
	   ***
	 ****
	***** **
	 ****  ***        Contentstack!
	   ***  ****
	     ** *****
	        ****
	       ***
	      **

Note: This version of contentstack-express command-line utility can be used only for V3 stacks. Use CLI version 1.x, for V2 stacks.


contentstack-express Command-line utility 3.1.5

Usage: contentstack [command]

Commands available
    connect            Connect to an existing stack in Contentstack
    sync               Synchronize the previously published entries in the current application
    publish            Publish content-types/assets/both on specified environment
    unpublish          Unpublish content-types/assets/both on specified environment
    plugin create      Create the new plugin in the current application

Options:
    -h, --help     output usage information
    -V, --version  output the version number

Documentation can be found at https://www.contentstack.com/docs/developers/about-web-framework
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
