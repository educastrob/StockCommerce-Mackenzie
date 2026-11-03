const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        app: "StockCommerce",
        status: "Ativo",
        version: "v1"
    });
});

// Listagem basica de produtos (UC03)
app.get('/api/produtos', (req, res) => {
    res.json([
        { id: 1, sku: 'PROD-001', nome: 'Produto A', precoVenda: 10.00, qtdEstoque: 10 },
        { id: 2, sku: 'PROD-002', nome: 'Produto B', precoVenda: 50.00, qtdEstoque: 2 }
    ]);
});

app.listen(PORT, () => {
    console.log(`Servidor StockCommerce rodando na porta ${PORT}`);
});