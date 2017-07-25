# Validate Password
> JS password validation for the client and the server.


[![npm version](https://badge.fury.io/js/validate-password.svg)](https://badge.fury.io/js/validate-password)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)]()

Enforce stronger passwords for users by checking for uppercase/lowercase letters, numbers, and special characters.

You can also check passwords for certain strings. This is ideal for preventing users from entering their name or email in the password. Or, you can search the password for common words, to further encourage the user to pick a strong password.


## Features

- [x] Lowercase verification
- [x] Uppercase verification
- [x] Special Characters verification
- [x] Numbers verification
- [x] Strings that are not allowed verification

## Installation
Install via NPM:

```
npm install validate-password
```

##Usage

This can be used as a stand alone package:

```html 
<script src="node_modules/validate-password/dist/validate-password.min.js"></script>
```

or as a CommonJS module:

```javascript
var ValidatePassword = require('validate-password');
```

Start by instantiating the password validator:

```javascript
var validator = new ValidatePassword();
```

...And use the ```.checkPassword()``` method to validate the password.

```.checkPassword()``` accepts two arguments - first, the password as a string:

```javascript
var passwordData = validator.checkPassword('aaaaa');

console.log(passwordData.isValid); // false
console.log(passwordData.validationMessage); // 'The password must contain at least one uppercase letter'
```

And, optionally, an array of strings that are not allowed to be in the password:

```javascript
var checkPasswordForName = validator.checkPassword('cat123aaBa$%^#$%#$%', ['cat123']);

console.log(passwordData.isValid); // false
console.log(passwordData.validationMessage); // 'The password cannot contain cat123'
```

See the examples directory for more detailed use cases...

##Options

By default, the validator checks for uppercase/lowercase letters, numbers, and special characters.  
You can also pass in custom configuration options when instantiating the validator, to loosen these default rules:

```javascript
var options = {
        enforce: {
            lowercase: true,
            uppercase: true,
            specialCharacters: false,
            numbers: true
        }
    };

var validator = new ValidatePassword(options);

```

The validator will now not check the password for special characters...


## Contribute

We would love for you to contribute to **validate-password**, check the ``LICENSE`` file for more info.

## Meta

Mike DeWitt – [http://devdewitt.com/](http://devdewitt.com/)

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/mndewitt/validate-password](https://github.com/mndewitt/validate-password)


