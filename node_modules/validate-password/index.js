module.exports = ValidatePassword;

/*
** Main ValidatePassword method
*/

function ValidatePassword(options) {
    this.options = options;
};

/*
** Polyfill for Object.assign
** See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#Polyfill
*/

if (typeof Object.assign != 'function') {
    (function () {
        Object.assign = function (target) {
            'use strict';
            if (target === undefined || target === null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            var output = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var source = arguments[index];
                if (source !== undefined && source !== null) {
                    for (var nextKey in source) {
                        if (source.hasOwnProperty(nextKey)) {
                            output[nextKey] = source[nextKey];
                        }
                    }
                }
            }
            return output;
        };
    })();
}

/*
** Main checkPassword method
*/

ValidatePassword.prototype.checkPassword = function(password, forbiddenStrings) {
    var validationData = {
        isValid: true,
        validationMessage: 'The password must contain at least one '
    };

    var defaultOptions = {
        enforce: {
            lowercase: true,
            uppercase: true,
            specialCharacters: true,
            numbers: true
        }
    };

    var options = Object.assign(defaultOptions, this.options);
    var checkForbiddenStringsData;
                
    if (!password) {
        return validationData;
    }

    if (!hasLowerCase(password) && options.enforce.lowercase) {
        validationData.validationMessage += 'lowercase letter';
        validationData.isValid = false;
        return validationData;
    }

    if (!hasUpperCase(password) && options.enforce.uppercase) {
        validationData.validationMessage += 'uppercase letter';
        validationData.isValid = false;
        return validationData;
    }

    if (!hasSpecialChars(password) && options.enforce.specialCharacters) {
        validationData.validationMessage += 'special character';
        validationData.isValid = false;
        return validationData;
    }

    if (!hasNumber(password) && options.enforce.numbers) {
        validationData.validationMessage += 'number';
        validationData.isValid = false;
        return validationData;
    }
    
    if (typeof forbiddenStrings !== 'undefined') {
        checkForbiddenStringsData = checkForbiddenStrings(password, forbiddenStrings);
        if (checkForbiddenStringsData.value) {
            validationData.isValid = false;
            validationData.validationMessage = 'The password cannot contain ' + checkForbiddenStringsData.foundString;
            return validationData;
        }
    }
    
    return validationData;
}

/*
** Helper methods
*/

function hasLowerCase(pw) {
    return (pw.toUpperCase() !== pw);
}

function hasUpperCase(pw) {
    return (pw.toLowerCase() !== pw);
}

function hasSpecialChars(pw) {
    return /[~`!@#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g.test(pw);
}

function hasNumber(pw) {
    return /[0-9]/.test(pw);  
}

function checkForbiddenStrings(pw, forbiddenStrings) {
    var checkForbiddenStringData = {
            value: false,
            foundString: ''
        };
        
    var upperCasePw = pw.toUpperCase();
    
    checkForbiddenStringData.value = forbiddenStrings.some(function(forbiddenString) {
         var isForbidden = (upperCasePw.indexOf(forbiddenString.toUpperCase()) > -1);  
         
         if(isForbidden) {
             checkForbiddenStringData.foundString = forbiddenString;
         }
         
         return isForbidden;
    });
    
    return checkForbiddenStringData;        
}
