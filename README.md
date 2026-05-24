# EcoRecicla — Oikos

**Integrantes:** Isabella Grorossi Muniz e Henrique Gustavo Lopes Ribeiro  
**Disciplina:** Técnicas de Programação II 

![Preview do projeto](https://i.ibb.co/2YLKRSPm/Screenshot-6-1.png)
---

## 1. Objetivo

Prefeituras e ONGs lidam com grandes volumes de dados sobre geração de resíduos e reciclagem, disponibilizados pelo SNIS (Sistema Nacional de Informações sobre Saneamento) em arquivos CSV brutos, difíceis de consultar e analisar.

O EcoRecicla — Oikos transforma esses dados em uma ferramenta de gestão ambiental: permite importar os arquivos do SNIS, visualizar os registros por município, identificar quais cidades estão abaixo da meta de reciclagem e gerenciar os dados via CRUD completo.

O nome "Oikos" tem origem no grego antigo e significa “casa” ou “ambiente em que vivemos”. A palavra também está relacionada à origem do termo “ecologia”, representando o cuidado com o meio ambiente e a gestão sustentável dos recursos naturais. Assim, reforça a proposta do projeto de conscientização ambiental, organização de dados ecológicos e incentivo à reciclagem de forma acessível e eficiente.

---

## 2. Documentação da API

### Mapeamento de Entidades — `RegistroResiduo`

| Campo              | Tipo      | Descrição                                                              |
|--------------------|-----------|------------------------------------------------------------------------|
| `id`               | `Long`    | Identificador único gerado automaticamente (chave primária)            |
| `municipio`        | `String`  | Nome do município.                                                     |
| `estado`           | `String`  | Sigla do estado (UF).                                                  |
| `quantidadeGerada` | `Double`  | Total de resíduos gerados/recebidos, em **toneladas**                  |
| `taxaReciclagem`   | `Double`  | Percentual de resíduos reciclados em relação ao total gerado (0–100 %) |
| `ano`              | `Integer` | Ano de referência do registro.                                         |

Para fins práticos o campo `quantidadeGerada` é preenchido com a coluna **UP080** (quantidade total recebida).  
A `taxaReciclagem` é estimada pela razão entre a coluna **UP067** e UP080, multiplicada por 100.  

---

### Endpoints

| Método   | Rota                                    | Descrição                                               | Status    |
|----------|-----------------------------------------|---------------------------------------------------------|-----------|
| `GET`    | `/api/residuos`                         | Lista todos os registros                                | 200       |
| `GET`    | `/api/residuos/{id}`                    | Busca um registro pelo ID                               | 200 / 404 |
| `POST`   | `/api/residuos`                         | Cria um novo registro                                   | 201       |
| `PUT`    | `/api/residuos/{id}`                    | Atualiza um registro existente                          | 200 / 404 |
| `DELETE` | `/api/residuos/{id}`                    | Remove um registro pelo ID                              | 204 / 404 |
| `GET`    | `/api/residuos/estado/{estado}`         | Filtra por estado. Ex: `/estado/SP`                     | 200 / 404 |
| `GET`    | `/api/residuos/municipio?nome=...`      | Busca por parte do nome do município                    | 200 / 404 |
| `GET`    | `/api/residuos/ano/{ano}`              | Filtra por ano de referência                            | 200 / 404 |
| `GET`    | `/api/residuos/abaixo-da-meta?meta=20`  | Lista municípios com taxa de reciclagem abaixo da meta  | 200       |
| `POST`   | `/api/residuos/importar-csv`            | Importa dados do CSV do SNIS                            | 201 / 400 |

---

### Exemplo de JSON

Formato esperado no corpo (`@RequestBody`) dos endpoints `POST` e `PUT`:

```json
{
  "municipio": "Campinas",
  "estado": "SP",
  "quantidadeGerada": 1250.5,
  "taxaReciclagem": 18.3,
  "ano": 2023
}
```

Resposta de sucesso do `POST /api/residuos` **(201 Created)**:

```json
{
  "id": 1,
  "municipio": "Campinas",
  "estado": "SP",
  "quantidadeGerada": 1250.5,
  "taxaReciclagem": 18.3,
  "ano": 2023
}
```

Resposta de erro ao buscar ID inexistente **(404 Not Found)**:

```json
{
  "timestamp": "2025-05-13T10:30:00",
  "status": 404,
  "erro": "Not Found",
  "mensagem": "Registro não encontrado"
}
```

Resposta da importação de CSV **(201 Created)**:

```json
{
  "mensagem": "Importação concluída!",
  "registrosImportados": 42
}
```

---

## 3. Diagrama de Arquitetura

Fluxo completo de uma requisição no sistema:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                             │
│          Tabela de listagem · Filtros · Formulário de cadastro      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  HTTP (JSON / multipart)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                @RestController — RegistroResiduoController          │
│  Recebe a requisição HTTP, valida o formato e delega ao Service.    │
│  Devolve ResponseEntity com o status correto (200, 201, 404...).    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  Chamada de método Java
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  @Service — RegistroResiduoService                  │
│  Contém a lógica de negócio: CRUD, filtros, leitura do CSV.         │
│  Usa Optional<T> para evitar NullPointerException.                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  Chamada de método Java
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              @Repository — RegistroResiduoRepository                │
│  Interface que estende JpaRepository. O Spring gera o SQL           │
│  automaticamente a partir dos nomes dos métodos.                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  SQL (JPA / Hibernate)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    H2 Database (arquivo em disco)                   │
│           ./data/ecorecicla.mv.db — persistência                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Camada extra — tratamento de erros:**

```
Qualquer exceção lançada no Controller ou Service
                    │
                    ▼
    @RestControllerAdvice — GlobalExceptionHandler
                    │
                    ▼
    JSON padronizado: { timestamp, status, erro, mensagem }
```

---

## 4. Guia de Execução

### Pré-requisitos

- Java 17 ou superior instalado
- Maven
- Node.js 20 ou superior instalado
- npm

---

### Backend

#### Rodando pelo terminal

```bash
# Entre na pasta do backend
cd backend/oikos

# Linux / macOS
./mvnw spring-boot:run

# Windows
mvnw.cmd spring-boot:run
```

A API sobe em: **http://localhost:9090**

#### Rodando pela IDE (IntelliJ / Eclipse)

1. Abra a pasta `backend/oikos` como projeto Maven
2. Aguarde o download das dependências
3. Localize a classe `OikosApplication.java`
4. Clique com botão direito → **Run 'OikosApplication'**

---

### Frontend

#### Rodando pelo terminal

```bash
# Entre na pasta do frontend
cd frontend/frontend

# Instale as dependências (apenas na primeira vez)
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação abre em: **http://localhost:5173**

#### Build para produção

```bash
cd frontend/frontend
npm run build
```

Os arquivos gerados ficam em `frontend/frontend/dist/`.

> O frontend consome a API em `http://localhost:9090`, portanto certifique-se de que o backend já está rodando antes de acessar a aplicação.

---

### Acessando o H2 Console

Com o backend rodando, acesse no navegador:

**http://localhost:9090/h2-console**

Preencha os campos assim:

| Campo        | Valor                            |
|--------------|----------------------------------|
| Driver Class | `org.h2.Driver`                  |
| JDBC URL     | `jdbc:h2:file:./data/ecorecicla` |
| User Name    | `sa`                             |
| Password     | *(deixe em branco)*              |

Clique em **Connect**. Você verá a tabela `REGISTRO_RESIDUO` com todos os dados persistidos.

> O banco é salvo em arquivo (`./data/ecorecicla.mv.db`), então os dados **não são perdidos** ao reiniciar o servidor.

---

### Testando a importação do CSV via Postman/Insomnia

1. Método: `POST`
2. URL: `http://localhost:9090/api/residuos/importar-csv`
3. Body: `form-data`
4. Chave: `arquivo` — Tipo: **File** — Valor: selecione o `.csv` do SNIS
5. Envie — a resposta mostrará quantos registros foram importados

O CSV do SNIS usa separador `;` e vírgula decimal (padrão brasileiro). O sistema trata isso automaticamente.
