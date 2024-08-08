// export function toggleDarkMode() {
//     const body = document.body;
//     const inputs = document.querySelectorAll('input');
//     const tableHead = document.querySelectorAll('th');
//     const indexRows = document.querySelectorAll('.index-row');
//     const mainTableRows = document.querySelectorAll('.main-table-row');
//     const buttons = document.querySelectorAll('.faculty-buttons button');

//     // Check current mode
//     const isDarkMode = body.classList.contains('dark-body');

//     // Toggle body class
//     body.classList.toggle('light-body');
//     body.classList.toggle('dark-body');

//     // Toggle table head classes
//     tableHead.forEach(th => {
//         th.classList.toggle('light-table', !isDarkMode);
//         th.classList.toggle('dark-table', isDarkMode);
//     });

//     // Toggle input fields classes
//     inputs.forEach(input => {
//         input.classList.toggle('light-input');
//         input.classList.toggle('dark-input');
//     });

//     // Toggle faculty buttons classes
//     buttons.forEach(button => {
//         button.classList.toggle('light-input');
//         button.classList.toggle('dark-input');
//     });

//     // Toggle table row classes
//     indexRows.forEach(row => {
//         if (!row.classList.contains('table-green') && !row.classList.contains('table-blue')) {
//             row.classList.toggle('light-table', !isDarkMode);
//             row.classList.toggle('dark-table', isDarkMode);
//         }
//     });

//     mainTableRows.forEach(row => {
//         if (!row.classList.contains('table-green') && !row.classList.contains('table-blue')) {
//             row.classList.toggle('light-table', !isDarkMode);
//             row.classList.toggle('dark-table', isDarkMode);
//         }
//     });
// }
