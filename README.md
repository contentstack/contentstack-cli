[![Built.io Contentstack](https://contentstackdocs.built.io/static/images/logo.png)](https://www.built.io/products/contentstack/overview)

# A CLI utilities for Built.io Contentstack

## Installation

Run the following command in a Terminal or Command Prompt to globally install the latest version of Built.io Contentstack CLI on your system:

```bash
$ npm install -g contentstack-cli
```
*You might need administrator privileges to perform this installation.*

## Commands in CLI

Built.io Contentstack CLI comes with handy commands which helps to achieve the support work for the contentstack-express like publishing, unpublishing, synchronizing the data, connecting existing stacks etc.

```

	     **
	   ***
	 ****
	***** **          .----------------------------------.
	 ****  ***        |     Built.io Contentstack!       |
	   ***  ****      '----------------------------------'
	     ** *****
	        ****
	       ***
	      **

Built.io Contentstack Command Line Interface 1.0.3

Usage: contentstack [command]

Commands:
    connect            Connect to an existing stack in Built.io Contentstack
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
 - [Website](https://www.built.io/products/contentstack/overview)
 - [Official Documentation](http://contentstackdocs.built.io/developer/javascript/quickstart)

### License
Copyright © 2012-2016 [Built.io](https://www.built.io/). All Rights Reserved.
=======
