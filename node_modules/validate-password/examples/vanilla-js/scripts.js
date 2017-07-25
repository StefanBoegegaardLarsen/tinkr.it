window.onload = function() {
    function basicPwValidation() {
        var passwordInput = document.getElementById('password');
        var validationMessageEl = document.getElementById('validation-message');
        var submitButton = document.getElementById('submit-button');
        
        submitButton.disabled = true;

        passwordInput.onkeyup = function passKeyup() {
            var currentVal = passwordInput.value;
            var validationData = ValidatePassword(currentVal);
            
            if(!validationData.isValid) {
                validationMessageEl.innerHTML = validationData.validationMessage;
                submitButton.disabled = true;
            } else {
                validationMessageEl.innerHTML = '';
                submitButton.disabled = false;           
            } 
        }     
    }
    
    function checkNamePwValidation() {
        var nameInput = document.getElementById('name');
        var passwordInput = document.getElementById('password-forbidden');
        var validationMessageEl = document.getElementById('validation-message-forbidden');
        var submitButton = document.getElementById('submit-button-forbidden');
        
        submitButton.disabled = true;

        passwordInput.onkeyup = function passKeyup() {
            var currentVal = passwordInput.value;
            var partsOfName = nameInput.value.match(/\S+/g);
            var validationData = ValidatePassword(currentVal, partsOfName);
            
            if(!validationData.isValid) {
                validationMessageEl.innerHTML = validationData.validationMessage;
                submitButton.disabled = true;
            } else {
                validationMessageEl.innerHTML = '';
                submitButton.disabled = false;           
            } 
        }     
    }
    
    basicPwValidation();
    checkNamePwValidation();
}