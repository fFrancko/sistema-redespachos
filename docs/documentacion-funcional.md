# **SISTEMA DE REDESPACHOS**

# **1\. CONTEXTO**

Actualmente el proceso de gestión de pedidos que requieran de redespacho se realiza manualmente. El proceso ejecutado por todas las sucursales consiste en la recepción de pedidos, aplicación de tarifa según zonas y coberturas, y posterior liquidación a los proveedores; dando lugar a errores de carga y complicación en la comunicación efectiva entre las áreas involucradas. Su automatización es clave para escalar las operaciones logísticas y evitar inconsistencias.

# **2\. OBJETIVO**

Crear un aplicativo web para identificar, gestionar, valorizar y liquidar los pedidos que requieran o no de redespacho (tercerizado). Dicha interfaz administrará el canalizador de códigos postales para identificar las zonas y, basándose en los tarifarios de los expresos cargados por Atención al Transportista, asignar las tarifas correspondientes a los pedidos.  
Este proyecto funciona de complemento para el (futuro) DataWarehouse corporativo, contribuyendo a la carga de la información relacionada y adoptando una visión de integración entre las áreas de la empresa.

# **3\. ALCANCE**

* Acceso por usuarios empresariales.  
* Interfaz web interactiva para la carga de pedidos.  
* Conexión con base de datos para almacenamiento de información productiva y resultante.  
* Gestión de proveedores: Alta \- Bajas \- Modificación.  
* Gestión de tarifas: Alta \- Bajas \- Modificación.  
* Envío de reporte de tarifas a carpeta de Drive.  
* Proceso zonificación de pedidos.  
* Proceso de valorización de pedidos.  
* Proceso de comparación de tarifa de compra contra tarifa de venta en base a Tarifario QX.  
* Envío de recibo a proveedores para solicitar confirmación de tarifa.  
* Generación de reporte de pedidos tarifados a Administración para su correspondiente liquidación.

# **4\. FUERA DE ALCANCE**

* ABM de sucursales.  
* ABM de choferes.  
* ABM de zonas y códigos postales.

# **5\. ACTORES INVOLUCRADOS**

| Área \- Bloque | Contacto |
| :---- | :---- |
| Sucursales | Pablo Guzman (Líder sucursales) |
| Carga de Proveedores | Marcelo Bustamante (Atención al Proveedor) |
| Carga de Tarifas Proveedores | Marcelo Bustamante (Atención al Proveedor) |
| Comparativa de Tarifas Venta | Nicolás Convertini (Comercial) |
| Confirmación Tarifa Proveedor | Marcelo Bustamante (Atención al Proveedor) |
| Gestión de pedidos | Evelina Espeche (BackOffice) |
| Liquidación Proveedores | Emilia Vila (Administración) |
| Desarrollo BackEnd, FrontEnd e Implementación | Franco Aranda (CDG) |

# **6\. IMPLEMENTACIÓN**

## **6.1. MVP**

* **Recursos disponibles:** Agentes de IA: OpenCode, Claude Code Pro, Antigravity Plus, Vertex AI (API GCC).  
* **Base de datos e infraestructura (sugerida):** Plan Blaze Firebase.  
* **Plataforma app-web:** Desarrollo coding.   
* **Repositorio:** GitHub.

## **6.2. Mejora Continua**

* **Infraestructura:** Debe tener la posibilidad de conectarse con distintas app webs (de este estilo y entorno) para trabajar de manera interrelacionada.  
* **Base de datos:** Debe estar preparado para conectarse con la base de datos de BigQuery (futuro DataWarehouse), tanto para recibir los datos (ingesta) necesarios para la realización del trabajo, como para transferir los datos producidos (operación y reportes).

## **6.3. Modelo de datos Principal (Tarifario Costos Proveedores)**

Se implementará un modelo relacional/tabular híbrido en una base de datos unificada.  
Las variables de peso (kg), volumen (m3), bultos/pallets y costos adicionales residirán en una misma tabla de reglas de valorización.  
**Columnas obligatorias de la base:**

* Identificación: Id\_proveedor, nombre\_proveedor; provincia\_origen, localidad\_origen, provincia\_destino, localidad\_destino, zona\_destino.  
* Intervalos y Límites: kg\_min, kg\_max, m3\_min, m3\_max.  
* Costos: costo\_base\_viaje, precio\_kg\_base, precio\_m3\_base, precio\_kg\_excedente, precio\_ bulto; precio\_pallet; aplica seguro (SI/NO), porcentaje\_seguro, IVA.  
* Adicionales: aplica\_colecta (SI/NO), costo\_colecta.

# **7\. FLUJO OPERATIVO \- BACKEND**

## **7.1. ACCESO**

### **Actores Involucrados**

Analistas de redespacho de las distintas sucursales; Administración de Proveedores; Administrador.

### **Objetivo**

Proporcionar distintos usuarios para el acceso de las herramientas correspondientes.

### **Requerimientos**

Implementación de autenticación (ej. Firebase Auth). Creación de roles con distintos niveles de permisos: Administrador (acceso total), Administración de Proveedores (acceso a ABM de expresos y tarifas), Analistas de Redespacho (acceso a importación y confirmación de pedidos).

### **Comportamiento ante errores / excepciones**

No permitir el acceso y dar la posibilidad de enviar una notificación (vía email/interfaz) para que un administrador pueda contemplar darle usuario.

## **7.2. CARGA DE EXPRESOS**

### **Actores Involucrados**

Administración de Proveedores.

### **Objetivo**

Cargar los transportes disponibles.

### **Requerimientos**

Formulario ABM parametrizable. Los datos mínimos a capturar son: ID\_Proveedor, Razón Social, CUIT, Email de contacto, Teléfono, Condición de pago, IVA. Estado (Activo/Inactivo). Posibilita agregar toda información relacionada con la gestión, contacto y liquidación del proveedor.

### **Comportamiento ante errores / excepciones**

Se debe tener un sistema de logs para identificar cambios correspondientes a los usuarios. Validación de campos obligatorios vacíos y CUITs duplicados.

## **7.3. CARGA DE TARIFAS**

### **Actores Involucrados**

Administración de Proveedores.

### **Objetivo**

Cargar las tarifas asignadas a los transportistas.

### **Requerimientos**

Formulario ABM parametrizable que alimente la Base de Datos Unificada. Debe permitir ingresar por cada fila los atributos paramétricos y los rangos límite de Kg y M3, así como los costos base y excedentes definidos en el Modelo de Datos. Se incorporan los importes en valores netos.

### **Comportamiento ante errores / excepciones**

Se debe tener un sistema de logs para identificar cambios correspondientes a los usuarios. El formulario debe bloquear la carga si los intervalos numéricos se superponen o si faltan datos obligatorios.

## **7.4. IMPORTAR PEDIDOS**

### **Actores Involucrados**

Analistas de redespacho.

### **Objetivo**

Permitir la carga de líneas de pedido mediante archivos xlsx o csv, con un formato estandarizado.

### **Requerimientos**

Importar un excel con la información de los pedidos.  
Se importará un archivo con las siguientes columnas:  
\[Código de Empresa; Código ERP; Tipo de Operación; Nro Pedido (OBLIGATORIO); Tipo de Servicio; Categoría; Sub Categoria; Código de Referencia; Peso Kgs(OBLIGATORIO); Volumen M3(OBLIGATORIO); Peso Aforado(OBLIGATORIO); Cantidad de Bultos(OBLIGATORIO); Valor Declarado; Valor Contra Reembolso; Tipo de Vehículo; Nro de Liquidación; Fecha de Liquidación; Id Tarifa; Valor Calculado Tarifa; Valor Calculado Seguro; Valor Calculado Reembolso; Total a Facturar; Status; Fecha Status; Fecha de Interfaz (OBLIGATORIO); Zona Origen(OBLIGATORIO); Cabecera Origen(OBLIGATORIO); Destinatario; Dirección; Número; Código Postal(OBLIGATORIO); Localidad(OBLIGATORIO); Provincia(OBLIGATORIO); Zona Destino; Cabecera; Fecha de Alta; Representante; Código de Dock; Codigo de Expreso; Nro Carta Porte; Fecha de Carta de Porte; Transporte; Chofer; Patente; Usuario Liquidación; IdLiquidacion; Código Postal Origen(OBLIGATORIO)\].

### **Comportamiento ante errores / excepciones**

Panel de revisión de pedidos. Se muestran la totalidad de los pedidos. Prioriza la observación de los pedidos con errores o sin cobertura. Permite avanzar con los validados y cancelar y exportar los pedidos con errores para su gestión.

## **7.5. ZONIFICACIÓN Y VALORIZACIÓN**

### **Actores Involucrados**

BackEnd.

### **Objetivo**

Zonificar y valorizar los pedidos importados mediante los parámetros de cada uno, utilizando el canalizador de códigos postales y las bases de las tarifas.

### **Requerimientos**

Código ejecutable para identificar la zona de cada pedido y buscar las opciones de tarifas.

* El motor de cotización debe evaluar las condiciones del envío real contra la base de datos.  
* Para cotizar el sistema debe mirar la tarifa vigente el día que el analista importa el Excel.  
* Debe aplicar la regla de cobro por el "Mayor Valor" por el cual se puede parametrizar el pedido, ajustándose al tarifario del proveedor que tenga cobertura en esa zona.  
* El sistema calculará el costo por peso y el costo por volumen de manera independiente.  
* Al valor resultante se le sumarán los excedentes de Kilómetros y el Costo de Colecta, si aplica.  
* Se mostrará opciones 2 opciones de proveedores con cobertura en la zona, priorizando el de menor costo (aplicando la regla “mayor valor”).	

### **Comportamiento ante errores / excepciones**

Si el destino o los parámetros (ej. peso excedido sin regla de excedente) no cruzan con ninguna tarifa de ningún proveedor, el pedido debe marcarse con estado "Sin Cobertura / Requiere Cotización Manual" para evitar que el proceso se detenga.

## **7.6. COMPARACIÓN COSTO/VENTA**

### **Actores Involucrados**

BackEnd; Tarifario comercial.

### **Objetivo**

Compara el resultado obtenido de las funciones de valorización contra los valores de venta asignados a dichos pedidos para tener un control sobre el retorno de la operación.

### **Requerimientos**

En base a la zonificación se buscan los pedidos en las tarifas de venta de QX Logística cargadas en la base de datos.  
El sistema debe cruzar el costo final calculado (Tarifa de Compra) con el valor de venta del tarifario de la empresa. Debe generar un margen de rentabilidad (Monto y Porcentaje).

### **Tarifario Comercial**

Columnas con información ejemplo:  
\[Cabecera Origen:BUE; Cabecera Destino: BUE; SubZona LM: Z1; Codigo: BUE-BUE-Z1; Rango KG: 1; Codigobuscador: BUE-BUE-Z1-1; Colecta: 320,83; LH: 0; LM: 6893,67; Total CON colecta: 7214,5; Total SIN colecta: 6893,67\].

### **Comportamiento ante errores / excepciones**

Si la tarifa de venta no existe en el sistema, debe permitir cargar el valor de venta de forma manual o alertar al usuario administrador.  
Resaltado de los pedidos con retorno negativo. Se puede avanzar si se desea. Deja log.

## **7.7. MÓDULO DE CONFIRMACIÓN**

### **Actores Involucrados**

Analistas de redespacho. Proveedores. Atención al Proveedor.

### **Objetivo**

Establecer contacto con el proveedor, vía mail, para que se le envíe un recibo de compra / proforma informando sobre la operación y darle oportunidad de autorizar o rechazar la tarifa tomada.

### **Requerimientos**

Envío automático de recibo proforma, en un email detallado, por proveedor con detalle de los datos de todos los pedidos, importe y tarifa utilizada y calculada por el sistema.  
Debe permitir la carga manual de la respuesta y su justificación (captura de mail o imagen) por parte del equipo de Atención al Proveedor para general un control por oposición contra los analistas que quieren valorizar los pedidos.  
Se debe permitir parametrizar la estructura del mail, así como el formato y copias de correos.

### **Comportamiento ante errores / excepciones**

Si el envío del correo falla, reintentar automáticamente 3 veces antes de marcar como "Error de Comunicación".  
Si el proveedor rechaza, cambia el estado del pedido a "Tarifa en Disputa". Se debe actualizar las tarifas, o volver a valorizar por otro proveedor.

## **7.8. REPORTE GENERACIÓN DE LIQUIDACIÓN**

### **Actores Involucrados**

BackEnd; Back Office.

### **Objetivo**

Generar un reporte con los pedidos autorizados para que el analista pueda observar, identificar errores y descargarlo para que le sirva como parámetro de liquidación dentro del sistema TMS.

### **Requerimientos**

Botón para exportar un archivo consolidado (.csv o .xlsx) con los pedidos en estado "Aceptado por Proveedor".  
Se guarda historial de los reportes generados. El analista debe confirmar el bloque de pedidos.  
Columnas de la tabla exportada:  
\[Código de Empresa; Código ERP; Tipo de Operación; Nro Pedido (OBLIGATORIO); Tipo de Servicio; Categoría; Sub Categoria; Código de Referencia; Peso Kgs(OBLIGATORIO); Volumen M3(OBLIGATORIO); Peso Aforado(OBLIGATORIO); Cantidad de Bultos(OBLIGATORIO); Valor Declarado; Valor Contra Reembolso; Tipo de Vehículo; Nro de Liquidación; Fecha de Liquidación; Id Tarifa; Valor Calculado Tarifa (OBLIGATORIO); Valor Calculado Seguro(OBLIGATORIO); Valor Calculado Reembolso; Total a Facturar (OBLIGATORIO); Status; Fecha Status; Fecha de Interfaz (OBLIGATORIO); Zona Origen(OBLIGATORIO); Cabecera Origen(OBLIGATORIO); Destinatario; Dirección; Número; Código Postal(OBLIGATORIO); Localidad(OBLIGATORIO); Provincia(OBLIGATORIO); Zona Destino; Cabecera; Fecha de Alta; Representante; Código de Dock; Codigo de Expreso; Nro Carta Porte; Fecha de Carta de Porte; Transporte; Chofer; Patente; Usuario Liquidación; IdLiquidacion; Código Postal Origen(OBLIGATORIO); fecha\_aceptacion(OBLIGATORIO)\].

### **Comportamiento ante errores / excepciones**

Prevenir la exportación de pedidos que aún estén en estado "Pendiente de Confirmación" o "En Disputa".

## **7.9 REPORTE GENERACIÓN DE ORDEN DE COMPRA**

### **Actores Involucrados**

BackEnd; Administración.

### **Objetivo**

Generar un reporte con los pedidos confirmados por el analista para que el área de Administración pueda descargarlo y le sirva como parámetro de creación de Orden de Compra en Finnegans.

### **Requerimientos**

Botón para exportar un archivo consolidado (.csv o .xlsx) con los pedidos en estado "Listo para generar OC".  
Se guarda historial de los reportes generados.  
Columnas obligatorias de la tabla exportada:  
\[numero; fecha: Hoy; proveedor: id\_proveedor; comprobante: vacío; condicionpago: condición de pago; sucursal: vacío; descripcion: vacío, producto: vacío; descripcionitem: vacío; cantidad: 1 por pedido; precio: importe total; preciosobre: 1; moneda\_cotizacion: “PES”; cotizacion:1 ; moneda: “PES”; workflow: CPRA-SERCON; fechacomprobante: Hoy; fechabasevencimiento: Hoy; destinatario: vacío; provincia\_destino: vacío; provincia\_destino\_item: vacío; fechaproximopaso: vacío; dimension: vacío; dimensionvalor: vacío\].

### **Comportamiento ante errores / excepciones**

Prevenir la exportación de pedidos que aún estén en otro estado.

## **8\. ESTÉTICA \- FRONTEND**

## **8.1 Colores a respetar**

Color primario \#323e48; Color secundario \#f5333f.

## **8.2 Logo**

### **Logo\_color\_positivo**![][image1]

### **Logo\_color\_negativo**

![][image2]

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAloAAADDCAYAAABarb9IAAAT3UlEQVR4Xu3du68tV30HcP6mBDDEjnmbKKGMQFRIRqRBwpIlUsSSIxqDFKcJFKaBSDwKjEByAQikIIVAExRwx8MuMZf2mtROFkcjzv3us2fNzFpr9uN8ftKnufe3HjP3yOvrffbe87a/ePJv3gIAoL+35R8AANCHoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKAFADCIoAUAMIigBQAwiKC1o//9y/ewQN63rV57x3sP5m6Va5yLr77rAwd7bZVrzHn48M23btfzL7x40MN+nn3uc4/8e/zujQcHPefqPX/794/svVT2bPEPz/zjI3OWn9nsgREErR28/Fj/Q/DaPXnHfVzj2wPvea51ar98x/sO9thLrnWXY/Xlr379oJfxjtV//8+rB73npuzxWGXvGhmyblf2Qm+C1mB/99cfPji8WOaTTzx1cD+Xyrl6evD29x6sdyojQ1aR66V//vy/5rn1SGU/Y9Uq+8/NXJVX6bJ/qbl65fs/OuiHngStgZ77qw8dHFys81/vfP/BfV1ij3ufa+6tBL7cU2+5Zvr5L46/AlEq+xkjf3V7rD7+9KcPxp6TuSo/a9m/VK2yH3oStAYpASEPLbbL+7vEq4Nf7Slyzb3kPkbINe8iaJ3WRz76ibzls9USVvYwVy17r1X2Q0+C1gB5YNHHx5748MG9rhn5Xq1JeQ9erjtSrt9buWe55jGC1ulsqRLMcp5zMleCFpdK0OosDy36yvu9xB5hK9ccJdcdIdecI2idxtbKec7NXAlaXCpBq5PyKbk8sBhjyycS93jP1pZ9rZHrjZBr1gha+5r7VN5cXcobvudK0OJSCVqd5IHFWHn/l9gjbG359WZNmTPX6W3rvgWtffzLv72Ut3ZR5Tznbq4ELS6VoNVJHlyMlfd/qXMOLcfk/L39oeHrKgSt8WpfoXFX5RyXYq5GBa1vvvzdg37oSdDqJA8vxsr7v8YeYau8epbrbpHz9lY+mZlrriFojbUmZLUEkXMxV63Xd1ddyq9UuWyCVid5gDFW3v+19nhPXUvY2uNpAms+XXiMoDXWj3/ys7ylB5VjLtlctQatSfmW+CL/HEYRtDrJQ4yx8v5vsUfY2vLVD3uErFxzK0FrvLuqvNKVfddgrnoFLdiboNVJHmSMlfe/Rc7d2w8eW/7t9nuEvy+8+4MH624laI13+yHLD9/848HfX5O5ErS4VIJWJ3mYMVbe/1Y5f2/lmYS5Zrqk945NBC16mitBi0slaHWSBxpj5f3vIdfobe5h1Ofw3MItBC16mitBi0slaHWSh1qr8mmwn77zOuS19ZD3v5dcp7e7wtalfr9XIWjR01wJWlwqQauTPNha5NzX4JnH+4aJnL+nXGuEaa3y/q38u95GfmO9oEVPcyVocakErU7ycGuRc1+LvM4WOXdvud6lGhmyihFB61e/eS2naa7nX3jxYJ21ygOZ19bShzjfNffHn/70QV9tTKnsW+J3bzzIabrV7XW+8a3v5F8Pq/K4ottr31XlgwZ5L2oePnwzp2mu8s3/uc5tI+ulr3ztYD36ErQ6yQOuRc59LfI6W+Tcve3x6b/R8ppG6Bm0bn+6blTlmku98r0f5lSLqxzMOV86Vtm3ZMyS9SYt17W0bu9n75rWLaH1WOU9OaZ899bIyvUmW59vubZyXfoRtDrJQ65Fzn0t8jpb5Nyj5LqXIq9jlF5Ba6/DpFQJF7n+Mb3D312vrM1V9i7dV/bfZc8qIeXLX/16/vHwmn7dOFfl1by8N2mPOvbdaHtWeTU516edoNVJHnQtcu5rkdfZIuceKdc+d7n/kXoErVPUkrBVCzOt9anPfPZPv7aZq9zTpPbqSvbveV13Vdlv7WdlRC0JWqXyHt22V5Ugmmvvuf5UwlZ/glYnedi1yLmvRV5ni5x7tD0+Gdiq5eHQW9UOz+xPp6zaKxnnULmnSUvQOkWV95O9+MWX8o+H1/Qsw1rlPTrFvXr2uc8drL/3HqbyiKK+BK1O8tBrkXNfi7zOFjn3HnIP5yb3u4dLDlqlcj+TY28037tyX5OtQWvNQ6p71rT+3rV03bxPxYgPZcxVrj8pTwM4ReU+2E7Q6iQPvRY597XI62yRc++lvGqUezkHuc+9tAStJQ9MHl3n8uuaY5X7mmwNWntXPjJo7k3pvev2qzK1yvu0ZEzPqn368Y3fP8ghw2vNhyqYJ2h1kgdfi5z7WuR1tsi593ROYat8sW3ub08tQWtJLf16hLssPZxyXPkVzpJq+fVK7b5NleMmo4LWr3/7+sGYPc1Vy/do1Sr7lwbClp+BU2r9+WMdQauTPABb5NzXIq+zRc69txJwck+nkPvaW+0/2Nk/qQWFUsfes7JGeY9OrXJM7ZpK9djbkl8J5ZhJ7f5l/5IxpXLM3uZqz6C15NXW2vecnbsllWPYRtDqJA/AFjn3tcjrbJFzn8Kpw1bu5xRqoST7J0s+6p9jtqrV2v78dViLWmX/pBaasr+o3fPsP4W52jNo1ar2q75LUavsZxtBq5M8BFvk3Ncir7NFzn0q337sAwd7G618AjL3cSpbg1ZtXM9fyawNGLXK/ha1X29m/2RL0Krd8+w/hbk6p6CV/Zeq9ivS7GcbQauTPAxb5NzXIq+zRc59Sp984qmD/Y2U65/S1sO7Nq5n0FobSmqV/S3WhsDJ2msqavc8+09hrgStMeYqe9lG0OokD8MWOfe1yOtskXOfWu5vlC+9+4MHa5/S1sO7Nk7Quqnsn6y9pqJ2z7P/FOZK0BpjrrKXbQStTvJAbJFzX4u8zhY59yl5Ret4Zf/ScYLWTWX/ZO01FbV7nv2nMFeC1hhzlb1sI2h1kodhi5z7WuR1tsi5T+Vl79HK/zY/Utm/dJygdVPZP1l7TUXtnmf/KcyVoDXGXGUv2whaneRh2CLnvhZ5nS1y7lPJfe2lBLzcyylsPbxr4wStm8r+ydprallrT3MlaP3ZN771nTsfxF7+7Nl/WvfVI3OVvWwjaHWSB2GLnPta5HW2yLn39uSTfa9ni3MIW7XAlP1LxwlaN5X9k7XXVCx5/E6O2dtc3fegVZ7NuaWef+HFg7lum6vsZRtBq5M8BFvk3L394LH3H6y5Vs65RM7RIufe0y9P/P1Zt5W95P72VAtM2b90nKB1U9k/WXtNkyX10le+djBuL3N1X4NWr2culle7cu5irrKXbQStTvIAbJFz99QrJLz2jvcezF2Tc7TIuffysSc+fLCXUztl2KoFpuxfOk7Quqnsn6y9psmedexgnzNX9zFoLXkVcm3lK1xzlfthG0Grkzz8WuTcPeVaLXLumhzfIufewzOPf+hgH+fiwdvXB98eaoEp+5eOE7RuKvsna69psuSxPyNq6TMr5+q+Ba1er2S1VO6JbQStTvLga5Fz95Rrtci5a3J8i5x7tPJJv9zDOcp9j1YLTNm/dJygdVPZP1l7TbedqsqrM7mXNFf3LWidQ+We2EbQ6iQPvBY5d0+5VoucuybHt8i5R8q1z13uf6RaYMr+peMErZvK/snaa7qtPKfvVJV7SXN1n4LWuVTui20ErU7ysGuRc/eUa7XIuWtyfIuce5RTfE9WD3kdo9QCU/YvHSdo3VT2T9ZeUzpV2Kq9b2uuBK39K/fFNoJWJ3nQtci5e8q1WuTcNTm+Rc49Qq8PDpxKXs8ItcCU/UvHCVo3lf2Ttdd0zCnes5V7uG2uBK0/V3kYdI5Za0nlGLYRtDrJQ65Fzt1TrtUi567J8S1y7t5yvUtVvu8rr62nWmDK/qXjBK2byv7J2mtaouyl/Lu0WFK57m1zVebP/qVq1drfU+3ftvw75ZitakE7+9lG0OokD7gWOXdPuVaLtQ84zvEtcu6eyif4cr1LltfXU+1wzf6l4wStm8r+ydpr2lOtsn/p2PsStLb+TGxRXhmbq+xnG0GrkzzcWn3m8Q+99fQTT3Xz+f8PRblGD19cELbK+jmuVa7Ryx4hK9fMvx8h1+ylFpiyf+k4Qeumsn+y9pr2VPvup+y/ba4ErZvK/lZzlb1sI2h1kgcbY+X97yHXGCHXPIe1W9QCU/YvHSdo3VT2T9Ze097mKnuXjhO0bir7W81V9rKNoNVJHmqMlfe/Vc4/Qq6Z9viurrJGrtuiFpiyf+k4Qeumsn+y9pr2NlfZu3ScoHVT2d9qrrKXbQStTvJAY6y8/y1y7hFyzWNy3Ai5ZotaYMr+peMErZvK/snaa9rbXGXv0nGC1k1lf6u5yl62EbQ6ycOMsfL+b1E+kZfz9vb6hmdC/uEE7xPbqhaYsn/pOEHrprJ/svaa9jZX2bt0nKB1U9nfaq6yl20ErU7yIGOsvP9r7fFw6FcbHvZcxuZ8vfV4GHUtMGX/0nE9g9azz30up3+ksr9W2d/ixz/5WU7/SGX/RNBap1at/T0JWtdH0OokDzHGyvu/Vs43Qq651h5hq/V7tmqBKfuXjivhKMds9c2Xv5vTP1LZX6vyreo5ZqtaZf9E0FqnVq39PQla10fQ6iQPMMbK+79GzjVCrrnVt3d4BFB5dS/XXaoWmLJ/UjtMSuWYrWq1tr9UjtmqVtk/Oeeg9cr3f5TbeaSy/7a5Oqeg1TNsp9orsD1f7f2P//xpTv9IZT/bCFqd5OHFWHn/l7jET/UV57zvrUFrybP2vvGt7xyMW+tXv3ktpz2oHFO7plLlgMpxay2pHDM556BVq+xfOnbPoLXkfwR6Bp5Uq+zfojx3slY5hm0ErU72eM8PN/LeL7HHw6FbXhlaItcbIdesqYWS7L9taZVQ86nPfHaVJQFrqtzXmr397o0HB2vPeekrX8spZiv3NWkNWrmvHpZeW+7ltrnaM2gtGTNV+fks1573Y42ta29Zd+m/U6ncF9sIWh3t8Sm2+y7v+VI5T29bPl241h5hvgTSXHdOS9CqvXdqjyrfYp77Ks6lcl+TrUHrle/9MFt3r9zTbXN1rkGrV91+UPS5VN4TthG0BsjDi3Zbg0z5ZF3O1VvLpwvX2iPMrwlbLUGrOHXlfiYf+egnsvUklfuabAla53BNx4LtZK72DlpLfn3Yu8r/fJS1a88g3KvynrCNoDXIHt+FdF98YcHzFO9yiucW7iX3MUKueZfWoHXKA6X2huZzqNzTZEvQqv1b7VG5pzRXewetovbG/hG1dM97VN4PthG0BsqDi/VKYM37ulTO1duXNgbAXnI/vf37u+qvbNUO7+y/yymq9srKHntb8opJ7mdyiUHrxS++dLCnNFenCFpLxvauad0lHxhpqfLzt+XniPUErcHy8GK5JQf9MWVsztfT1k/p9Zb76i3XS7X3WWX/MbV5etbSkFX0Puxy7VrYyv3cNlfZW9S+HHVk/fq3rx/s5y5zlfdujblasrc9a+Tad31Scu5Vu+xlG0FrB36NuF7ew7VGvpcp1zq1UT9fS9979vDNP+Z/n/9Ut9/cu9ToyvWWqgWiuXrj9w8O5ls6b/bfdqxKoMre2piRlXuYU8LUscreNeYCc/Yes8d73I79Orv2c1KrnC8dq+xjG0FrJ3t8y/e1yHu3Vc7bw+ivcNgq99lDrjEnay5c1Mz9H/bWKodkrrPFmioBNMen2gGa/emuyp7b5oJM7yrXlusvcdcejwWQNe761Wn2LFFeARtRS65xzauSS16pm9wVRHs+neG+E7Tukd7fMn7q9yjBpWsNWsD5E7TumQxLLQQtaCNowfUTtO6ZDEstBC1oI2jB9RO07pkMSy0ELWgjaMH1E7TumQxLLQQtaCNowfUTtO6ZDEstBC1oI2jB9RO07pkMSy0ELWgjaMH1E7TumQxLLT75xFMH8wPLCVpw/QSteybD0lYtzyAEbvzqN69ltnqksh+4PILWPZOBaY0Srp55/Dye8QfXoFbZD1weQeueyfA056fvfN9bX/A+LBjirseeZOUY4PIIWvdQBqrCG9thP8+/8GJmqjsrxwGXR9ACaPDxpz+d+ahLlYcr51rA5RG0ABqMqlwHuEyCFsBGP//Fq5mPutQbv39wsBZwmQQtgI1GVa4DXC5BC2Cjh2/+MTNSU/36t68frAFcNkELYKPyhvVeVUJbzg9cPkELoEHrq1qvfP9HB3MC10PQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGETQAgAYRNACABhE0AIAGOT/AGxr/0AUVXMXAAAAAElFTkSuQmCC>