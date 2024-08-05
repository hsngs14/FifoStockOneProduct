// script.js
let transactions = [];
let purchases = [];
let purchaseTrack = {}; // Track remaining quantities for each purchase
let currentStock = 0;
let nextId = 1; // Initialize the ID counter

// Load data from local storage when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    updateInventoryTable();
});

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

function validateInput() {
    let quantityInput = document.getElementById('quantity');
    let priceInput = document.getElementById('price');
    
    if (quantityInput.value.trim() === '' || priceInput.value.trim() === '') {
        alert('Please enter both quantity and price.');
        return false;
    }

    let quantity = parseFloat(quantityInput.value);
    let price = parseFloat(priceInput.value);

    if (isNaN(quantity) || quantity <= 0) {
        alert('Quantity must be a number greater than 0.');
        return false;
    }

    if (isNaN(price) || price <= 0) {
        alert('Price must be a number greater than 0.');
        return false;
    }

    return true;
}

function addTransaction(type) {
    let quantity = parseFloat(document.getElementById('quantity').value);
    let price = parseFloat(document.getElementById('price').value);
    let total = quantity * price;
    let id = nextId++; // Assign the next ID and increment

    if (type === 'sale') {
        let { benefit, avgPrice, comment, stockSources } = calculateBenefitAndAvgPrice(quantity, price);
        transactions.push({ id, type, quantity, price, total, benefit, avgPrice, comment, stockSources });
        currentStock -= quantity;
    } else {
        transactions.push({ id, type, quantity, price, total });
        purchases.push({ id, quantity, price, total, remaining: quantity });
        purchaseTrack[id] = quantity; // Track remaining quantity for each purchase
        currentStock += quantity;
    }
    
    updateInventoryTable();
    saveToLocalStorage(); // Save after adding a transaction
    document.getElementById('transaction-form').reset();
}

function updateInventoryTable() {
    let stock = 0;
    let tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = '';
    transactions.forEach((transaction) => {
        stock += (transaction.type === 'purchase' ? transaction.quantity : -transaction.quantity);
        let row = tbody.insertRow();
        row.className = transaction.type === 'purchase' ? 'purchase-row' : 'sale-row';
        row.insertCell(0).textContent = transaction.id;
        row.insertCell(1).textContent = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
        row.insertCell(2).textContent = transaction.quantity;
        row.insertCell(3).textContent = transaction.price;
        row.insertCell(4).textContent = transaction.total.toFixed(2);
        row.insertCell(5).textContent = transaction.benefit !== undefined ? transaction.benefit.toFixed(2) : 'Not Available';
        row.insertCell(6).textContent = transaction.avgPrice !== undefined ? transaction.avgPrice.toFixed(2) : 'Not Available';
        row.insertCell(7).textContent = stock;
        
        let commentCell = row.insertCell(8);
        commentCell.textContent = transaction.comment || 'N/A';
        if (transaction.stockSources) {
            let sourcesText = Object.entries(transaction.stockSources)
                .map(([purchaseId, quantity]) => `Purchase #${purchaseId}: ${quantity} units`)
                .join('; ');
            commentCell.textContent += ` (Sources: ${sourcesText})`;
        }

        let remaining = 'N/A';
        if (transaction.type === 'purchase') {
            remaining = purchaseTrack[transaction.id] || 'N/A';
        }
        row.insertCell(9).textContent = remaining;
        let editCell = row.insertCell(10);
        let editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => editTransaction(transaction.id, row);
        editCell.appendChild(editButton);
    });
    currentStock = stock; // Update the global stock variable
}

function editTransaction(id, row) {
    let transaction = transactions.find(t => t.id === id);
    row.cells[2].innerHTML = `<input type="number" value="${transaction.quantity}" id="edit-quantity-${id}" min="0.01" step="0.01">`;
    row.cells[3].innerHTML = `<input type="number" value="${transaction.price}" id="edit-price-${id}" min="0.01" step="0.01">`;
    row.cells[9].innerHTML = '';
    let saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.onclick = () => saveTransaction(id, row);
    row.cells[9].appendChild(saveButton);
}

function saveTransaction(id, row) {
    let quantityInput = document.getElementById(`edit-quantity-${id}`);
    let priceInput = document.getElementById(`edit-price-${id}`);

    if (quantityInput.value.trim() === '' || priceInput.value.trim() === '') {
        alert('Please enter both quantity and price.');
        return;
    }

    let newQuantity = parseFloat(quantityInput.value);
    let newPrice = parseFloat(priceInput.value);

    if (isNaN(newQuantity) || newQuantity <= 0) {
        alert('Quantity must be a number greater than 0.');
        return;
    }

    if (isNaN(newPrice) || newPrice <= 0) {
        alert('Price must be a number greater than 0.');
        return;
    }

    let transaction = transactions.find(t => t.id === id);
    let oldQuantity = transaction.quantity;
    let tempStock = currentStock + (transaction.type === 'purchase' ? -oldQuantity : oldQuantity);

    if (transaction.type === 'purchase') {
        handlePurchaseEdit(transaction, newQuantity, newPrice);
    } else {
        handleSaleEdit(transaction, oldQuantity, newQuantity, newPrice);
    }

    updateInventoryTable();
    recalculateSales();
    saveToLocalStorage(); // Save after editing a transaction
}

function handlePurchaseEdit(transaction, newQuantity, newPrice) {
    let quantityDiff = newQuantity - transaction.quantity;
    transaction.quantity = newQuantity;
    transaction.price = newPrice;
    transaction.total = newQuantity * newPrice;

    let purchase = purchases.find(p => p.id === transaction.id);
    purchase.quantity = newQuantity;
    purchase.price = newPrice;
    purchase.total = newQuantity * newPrice;
    purchase.remaining += quantityDiff;
    purchaseTrack[transaction.id] += quantityDiff;
    currentStock += quantityDiff;
}

function handleSaleEdit(transaction, oldQuantity, newQuantity, newPrice) {
    if (newQuantity < oldQuantity) {
        returnStockToPurchases(transaction, oldQuantity - newQuantity);
    }

    transaction.quantity = newQuantity;
    transaction.price = newPrice;
    transaction.total = newQuantity * newPrice;

    let { benefit, avgPrice, comment, stockSources } = calculateBenefitAndAvgPrice(newQuantity, newPrice);
    transaction.benefit = benefit;
    transaction.avgPrice = avgPrice;
    transaction.comment = comment;
    transaction.stockSources = stockSources;
    currentStock += oldQuantity - newQuantity;
}

function returnStockToPurchases(transaction, quantityToReturn) {
    let remainingToReturn = quantityToReturn;
    let updatedStockSources = { ...transaction.stockSources };

    // Sort purchase IDs in descending order to return stock to the last purchases first
    let sortedPurchaseIds = Object.keys(transaction.stockSources).sort((a, b) => b - a);

    for (let purchaseId of sortedPurchaseIds) {
        if (remainingToReturn <= 0) break;

        let quantityFromThisPurchase = transaction.stockSources[purchaseId];
        let quantityToReturnToThisPurchase = Math.min(remainingToReturn, quantityFromThisPurchase);

        purchaseTrack[purchaseId] += quantityToReturnToThisPurchase;
        remainingToReturn -= quantityToReturnToThisPurchase;

        if (quantityToReturnToThisPurchase === quantityFromThisPurchase) {
            delete updatedStockSources[purchaseId];
        } else {
            updatedStockSources[purchaseId] -= quantityToReturnToThisPurchase;
        }

        // Update the remaining quantity for the purchase
        let purchase = purchases.find(p => p.id === parseInt(purchaseId));
        if (purchase) {
            purchase.remaining += quantityToReturnToThisPurchase;
        }
    }

    transaction.stockSources = updatedStockSources;
}

function calculateBenefitAndAvgPrice(saleQuantity, salePrice) {
    let remainingSaleQuantity = saleQuantity;
    let benefit = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    let comment = '';
    let stockSources = {};

    for (let purchase of purchases) {
        if (remainingSaleQuantity <= 0) break;
        let availableQuantity = purchaseTrack[purchase.id];
        if (availableQuantity > 0) {
            let quantityUsed = Math.min(remainingSaleQuantity, availableQuantity);
            benefit += quantityUsed * (salePrice - purchase.price);
            totalCost += quantityUsed * purchase.price;
            totalQuantity += quantityUsed;
            comment += `${quantityUsed} units at ${purchase.price.toFixed(2)} each; `;
            remainingSaleQuantity -= quantityUsed;
            purchaseTrack[purchase.id] -= quantityUsed;
            stockSources[purchase.id] = quantityUsed;
        }
    }

    // If there's still remaining sale quantity, use the last purchase price for the calculation
    if (remainingSaleQuantity > 0 && purchases.length > 0) {
        let lastPurchase = purchases[purchases.length - 1];
        benefit += remainingSaleQuantity * (salePrice - lastPurchase.price);
        totalCost += remainingSaleQuantity * lastPurchase.price;
        totalQuantity += remainingSaleQuantity;
        comment += `${remainingSaleQuantity} units at ${lastPurchase.price.toFixed(2)} each (negative stock); `;
        stockSources[lastPurchase.id] = (stockSources[lastPurchase.id] || 0) + remainingSaleQuantity;
    }

    let avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : undefined;
    return { 
        benefit: totalQuantity > 0 ? benefit : undefined, 
        avgPrice, 
        comment: totalQuantity > 0 ? comment.trim() : 'Not Available',
        stockSources
    };
}

function recalculateSales() {
    // Reset purchaseTrack
    purchaseTrack = {};
    purchases.forEach((purchase) => {
        purchaseTrack[purchase.id] = purchase.quantity;
    });

    let stock = 0;
    transactions.forEach((transaction) => {
        if (transaction.type === 'purchase') {
            stock += transaction.quantity;
        } else if (transaction.type === 'sale') {
            stock -= transaction.quantity;
            let { benefit, avgPrice, comment, stockSources } = calculateBenefitAndAvgPrice(transaction.quantity, transaction.price);
            transaction.benefit = benefit;
            transaction.avgPrice = avgPrice;
            transaction.comment = comment;
            transaction.stockSources = stockSources;
        }
    });
    updateInventoryTable();
    currentStock = stock; // Ensure global stock is updated after recalculation
    saveToLocalStorage(); // Save after recalculating sales
}

// New function to save data to local storage
function saveToLocalStorage() {
    localStorage.setItem('inventoryData', JSON.stringify({
        transactions: transactions,
        purchases: purchases,
        purchaseTrack: purchaseTrack,
        currentStock: currentStock,
        nextId: nextId
    }));
}

// New function to load data from local storage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('inventoryData');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        transactions = parsedData.transactions;
        purchases = parsedData.purchases;
        purchaseTrack = parsedData.purchaseTrack;
        currentStock = parsedData.currentStock;
        nextId = parsedData.nextId;
    }
}

// Initial table update
updateInventoryTable();