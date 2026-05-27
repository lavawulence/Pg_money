// Configuration admin
const ADMIN_CONFIG = {
    SECRET_CODE: 'LAVAWULE',
    MAIN_ADMIN: '242044106402',
    ADDITIONAL_ADMINS: []
};

function isAdminNumber(number) {
    return number === ADMIN_CONFIG.MAIN_ADMIN || 
           ADMIN_CONFIG.ADDITIONAL_ADMINS.includes(number);
}

module.exports = { ADMIN_CONFIG, isAdminNumber };