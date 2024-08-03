// script.js

let transactions = [];
let purchases = [];
let purchaseTrack = {}; // Track remaining quantities for each purchase
let currentStock = 0;

document.getElementById('add-purchase').addEventListener('click', function() {
    if (validateInput()) {
        addTransaction('purchase');
    }
});

document.getElementById('add-sale').addEventListener('click', function() {
    if (validateInput()) {
        addTransaction('sale');
    }
});

document.getElementById('print-button').addEventListener('click', function() {
    window.print();
});

function validateInput() {
    let quantityInput = document.getElementById('quantity');
    let priceInput = document.getElementById('price');
    
    if (quantityInput.value.trim() === '' || priceInput.value.trim() === '') {
        alert('يرجى إدخال الكمية والسعر.');
        return false;
    }

    let quantity = parseFloat(quantityInput.value);
    let price = parseFloat(priceInput.value);

    if (isNaN(quantity) || quantity <= 0) {
        alert('يجب أن تكون الكمية رقماً أكبر من 0.');
        return false;
    }

    if (isNaN(price) || price <= 0) {
        alert('يجب أن يكون السعر رقماً أكبر من 0.');
        return false;
    }

    return true;
}

function addTransaction(type) {
    let quantity = parseFloat(document.getElementById('quantity').value);
    let price = parseFloat(document.getElementById('price').value);
    let total = quantity * price;

    if (type === 'sale') {
        let { benefit, avgPrice, comment } = calculateBenefitAndAvgPrice(quantity, price);
        transactions.push({ type, quantity, price, total, benefit, avgPrice, comment });
        currentStock -= quantity;
    } else {
        transactions.push({ type, quantity, price, total });
        purchases.push({ quantity, price, total, remaining: quantity });
        purchaseTrack[purchases.length - 1] = quantity; // Track remaining quantity for each purchase
        currentStock += quantity;
    }

    updateInventoryTable();
    document.getElementById('transaction-form').reset();
    saveStateToLocalStorage();
}

function updateInventoryTable() {
    let stock = 0;
    let tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = '';
    transactions.forEach((transaction, index) => {
        stock += (transaction.type === 'purchase' ? transaction.quantity : -transaction.quantity);
        let row = tbody.insertRow();
        row.className = transaction.type === 'purchase' ? 'purchase-row' : 'sale-row';
        row.insertCell(0).textContent = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
        row.insertCell(1).textContent = transaction.quantity;
        row.insertCell(2).textContent = transaction.price;
        row.insertCell(3).textContent = transaction.total.toFixed(2);
        row.insertCell(4).textContent = transaction.benefit !== undefined ? transaction.benefit.toFixed(2) : 'غير متوفر';
        row.insertCell(5).textContent = transaction.avgPrice !== undefined ? transaction.avgPrice.toFixed(2) : 'غير متوفر';
        row.insertCell(6).textContent = stock;
        row.insertCell(7).textContent = transaction.comment || 'غير متوفر';

        let remaining = 'غير متوفر';
        if (transaction.type === 'purchase') {
            remaining = purchaseTrack[index] || 'غير متوفر';
        }
        row.insertCell(8).textContent = remaining;
        let editCell = row.insertCell(9);
        let editButton = document.createElement('button');
        editButton.textContent = 'تعديل';
        editButton.onclick = () => editTransaction(index, row);
        editCell.appendChild(editButton);
    });
    currentStock = stock; // Update the global stock variable
}

function calculateBenefitAndAvgPrice(saleQuantity, salePrice) {
    let remainingSaleQuantity = saleQuantity;
    let benefit = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    let comment = '';

    for (let i = 0; i < purchases.length; i++) {
        if (remainingSaleQuantity <= 0) break;
        let purchase = purchases[i];
        if (purchaseTrack[i] > 0) {
            let quantityUsed = Math.min(remainingSaleQuantity, purchaseTrack[i]);
            benefit += quantityUsed * (salePrice - purchase.price);
            totalCost += quantityUsed * purchase.price;
            totalQuantity += quantityUsed;
            comment += `${quantityUsed} وحدة بسعر ${purchase.price.toFixed(2)} لكل واحدة; `;
            remainingSaleQuantity -= quantityUsed;
            purchaseTrack[i] -= quantityUsed;
        }
    }

    // If there's still remaining sale quantity, use the last purchase price for the calculation
    if (remainingSaleQuantity > 0 && purchases.length > 0) {
        let lastPurchase = purchases[purchases.length - 1];
        benefit += remainingSaleQuantity * (salePrice - lastPurchase.price);
        totalCost += remainingSaleQuantity * lastPurchase.price;
        totalQuantity += remainingSaleQuantity;
        comment += `${remainingSaleQuantity} وحدة بسعر ${lastPurchase.price.toFixed(2)} لكل واحدة (مخزون سلبي); `;
    }

    let avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : undefined;
    return { benefit: totalQuantity > 0 ? benefit : undefined, avgPrice, comment: totalQuantity > 0 ? comment.trim() : 'غير متوفر' };
}

function editTransaction(index, row) {
    let transaction = transactions[index];
    row.cells[1].innerHTML = `<input type="number" value="${transaction.quantity}" id="edit-quantity-${index}" min="0.01" step="0.01">`;
    row.cells[2].innerHTML = `<input type="number" value="${transaction.price}" id="edit-price-${index}" min="0.01" step="0.01">`;
    row.cells[8].innerHTML = '';
    let saveButton = document.createElement('button');
    saveButton.textContent = 'حفظ';
    saveButton.onclick = () => saveTransaction(index, row);
    row.cells[8].appendChild(saveButton);
}

function saveTransaction(index, row) {
    let quantityInput = document.getElementById(`edit-quantity-${index}`);
    let priceInput = document.getElementById(`edit-price-${index}`);

    if (quantityInput.value.trim() === '' || priceInput.value.trim() === '') {
        alert('يرجى إدخال الكمية والسعر.');
        return;
    }

    let quantity = parseFloat(quantityInput.value);
    let price = parseFloat(priceInput.value);

    if (isNaN(quantity) || quantity <= 0) {
        alert('يجب أن تكون الكمية رقماً أكبر من 0.');
        return;
    }

    if (isNaN(price) || price <= 0) {
        alert('يجب أن يكون السعر رقماً أكبر من 0.');
        return;
    }

    let total = quantity * price;

    let tempStock = currentStock + (transactions[index].type === 'purchase' ? -transactions[index].quantity : transactions[index].quantity);

    transactions[index].quantity = quantity;
    transactions[index].price = price;
    transactions[index].total = total;

    if (transactions[index].type === 'purchase') {
        purchases[index] = { quantity, price, total, remaining: quantity };
        purchaseTrack[index] = quantity;
        currentStock = tempStock + quantity;
    } else {
        let { benefit, avgPrice, comment } = calculateBenefitAndAvgPrice(quantity, price);
        transactions[index].benefit = benefit;
        transactions[index].avgPrice = avgPrice;
        transactions[index].comment = comment;
        currentStock = tempStock - quantity;
    }

    updateInventoryTable();
    saveStateToLocalStorage();
}

function recalculateSales() {
    // Reset purchaseTrack
    purchaseTrack = {};
    purchases.forEach((purchase, index) => {
        purchaseTrack[index] = purchase.quantity;
    });

    let stock = 0;
    transactions.forEach((transaction, index) => {
        if (transaction.type === 'purchase') {
            stock += transaction.quantity;
        } else if (transaction.type === 'sale') {
            stock -= transaction.quantity;
            let { benefit, avgPrice, comment } = calculateBenefitAndAvgPrice(transaction.quantity, transaction.price);
            transactions[index].benefit = benefit;
            transactions[index].avgPrice = avgPrice;
            transactions[index].comment = comment;
        }
    });
    updateInventoryTable();
    currentStock = stock; // Ensure global stock is updated after recalculation
}

function saveStateToLocalStorage() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('purchases', JSON.stringify(purchases));
    localStorage.setItem('purchaseTrack', JSON.stringify(purchaseTrack));
    localStorage.setItem('currentStock', currentStock);
}

function loadStateFromLocalStorage() {
    let savedTransactions = localStorage.getItem('transactions');
    let savedPurchases = localStorage.getItem('purchases');
    let savedPurchaseTrack = localStorage.getItem('purchaseTrack');
    let savedCurrentStock = localStorage.getItem('currentStock');

    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    }
    if (savedPurchases) {
        purchases = JSON.parse(savedPurchases);
    }
    if (savedPurchaseTrack) {
        purchaseTrack = JSON.parse(savedPurchaseTrack);
    }
    if (savedCurrentStock) {
        currentStock = parseFloat(savedCurrentStock);
    }

    updateInventoryTable();
}

// Load saved state when the page loads
loadStateFromLocalStorage();

// Initial table update
updateInventoryTable();
