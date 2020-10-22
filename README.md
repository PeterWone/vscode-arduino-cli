# Arduino-CLI integration

Improves the Arduino development experience by asking questions you _can_ answer and offering you just those settings and options that apply to the gear you actually have. Compiler and header file paths and pragmas are updated automatically as a result of adding or removing a library.

## Features

Arduino CLI integration on Mac, Linux and Windows

Functionally equivalent to the Microsoft Arduino extension but doesn't have the recurring problem with serial ports not working. The _other_ main complaint is that you have to configure all the C++ pathing to get Intellisense to work. Automatic C++ path configuration is planned but not yet done.

## Requirements

* Arduino CLI

## Extension Settings

Arduino CLI integration is highly configurable. Settings can be modified by going to Code > Preferences > Settings > Extensions > Arduino-CLI.

**A detailed breakdown of these settings can be found in [the manual](https://github.com/PeterWone/vscode-arduino-cli/blob/master/manual.md).** (which doesn't exist yet)

## Known Issues

Installing Arduino-CLI is not yet implemented. 
For now, manual install per instructions at https://arduino.github.io/arduino-cli/installation/
Basically you get the zip for your platform, pull out the exe and put it on your path.
Then tell the extension where it is in VS Code settings. 

Path management for intellisense is not yet implemented.

## Release Notes

TBA
